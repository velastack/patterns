import dedent from "dedent";
import type { Options } from "./types";
import { parseModel, type Collection, type Field, type Model } from "../parse";

const GENERATED_DATE = "2024-01-01T00:00:00.000Z";

class RawExpression {
  constructor(public readonly expression: string) {}
}

type FixtureValue =
  | string
  | number
  | boolean
  | null
  | FixtureValue[]
  | { [key: string]: FixtureValue }
  | RawExpression;

type RuntimeCollectionField = Collection["fields"][number] & {
  values?: string[];
  system?: boolean;
};

type ScaffoldUrls = {
  list: string;
  new: string;
  show: string;
  edit: string;
};

function fixtureToCode(value: FixtureValue): string {
  if (value instanceof RawExpression) {
    return value.expression;
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => fixtureToCode(entry)).join(", ")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .map(([key, entry]) => `${JSON.stringify(key)}: ${fixtureToCode(entry)}`)
      .join(", ");
    return `{ ${entries} }`;
  }

  return JSON.stringify(value);
}

function fixtureObjectToCode(data: Record<string, FixtureValue>): string {
  const entries = Object.entries(data).map(
    ([key, value]) => `${JSON.stringify(key)}: ${fixtureToCode(value)}`,
  );
  return `{ ${entries.join(", ")} }`;
}

function fieldTypeFromCollectionField(
  rawType: string,
): Field["type"] | undefined {
  switch (rawType) {
    case "text":
    case "number":
    case "bool":
    case "date":
    case "email":
    case "password":
    case "url":
    case "editor":
    case "autodate":
    case "select":
    case "file":
    case "json":
    case "geoPoint":
    case "relation":
      return rawType;
    case "string":
      return "text";
    case "boolean":
      return "bool";
    case "datetime":
    case "timestamp":
      return "date";
    case "references":
      return "relation";
    case "float":
    case "integer":
    case "int":
    case "decimal":
    case "double":
      return "number";
    default:
      return undefined;
  }
}

function relationUrl(url: string, idExpression: string): string {
  return url.replace("[id]", `\${${idExpression}}`);
}

function mockValueForField(
  field: Pick<Field, "name" | "type"> & Partial<Field>,
  relationIdsByCollectionId: Record<string, string>,
  options: { forForm: boolean; authEnabled: boolean },
): FixtureValue | undefined {
  switch (field.type) {
    case "text":
    case "editor":
      return `${field.name} value`;
    case "number":
      return 42;
    case "bool":
      return true;
    case "date":
      return GENERATED_DATE;
    case "email":
      return `test-${field.name}@example.com`;
    case "password":
      return "password";
    case "url":
      return "https://example.com";
    case "json":
      return options.forForm
        ? JSON.stringify({ [field.name]: "value" })
        : { [field.name]: "value" };
    case "geoPoint":
      return options.forForm
        ? JSON.stringify({ lat: 40.7128, lon: -74.006 })
        : { lat: 40.7128, lon: -74.006 };
    case "select": {
      const value = field.options?.[0]?.value ?? "default";
      return field.maxSelect && field.maxSelect > 1 ? [value] : value;
    }
    case "relation": {
      if (
        options.authEnabled &&
        (field.isCurrentUser || field.relatedModel?.tableName === "users")
      ) {
        return new RawExpression("context.user.id");
      }

      const relationId = field.collectionId
        ? relationIdsByCollectionId[field.collectionId]
        : undefined;
      if (relationId) {
        return new RawExpression(relationId);
      }
      return "missing-relation-id";
    }
    case "file":
    case "autodate":
      return undefined;
    default:
      return undefined;
  }
}

function fixtureDataFromFields(
  fields: Field[],
  relationIdsByCollectionId: Record<string, string>,
  options: { forForm: boolean; authEnabled: boolean },
): Record<string, FixtureValue> {
  const data: Record<string, FixtureValue> = {};

  for (const field of fields) {
    if (field.type === "file" || field.type === "autodate") {
      continue;
    }

    if (
      options.authEnabled &&
      field.type === "relation" &&
      field.isCurrentUser
    ) {
      if (!options.forForm) {
        data[field.name] = new RawExpression("context.user.id");
      }
      continue;
    }

    const value = mockValueForField(field, relationIdsByCollectionId, options);
    if (value !== undefined) {
      data[field.name] = value;
    }
  }

  return data;
}

function fixtureDataFromCollectionFields(
  fields: RuntimeCollectionField[],
  relationIdsByCollectionId: Record<string, string>,
  options: Pick<Options, "features">,
): Record<string, FixtureValue> {
  const data: Record<string, FixtureValue> = {};

  for (const field of fields) {
    if (field.system || field.name === "id") {
      continue;
    }

    const type = fieldTypeFromCollectionField(field.type);
    if (!type || type === "file" || type === "autodate") {
      continue;
    }

    if (type === "relation" && !field.collectionId) {
      continue;
    }

    let value: FixtureValue | undefined;
    if (type === "relation") {
      value = field.collectionId
        ? new RawExpression(
            relationIdsByCollectionId[field.collectionId] ??
              '"missing-relation-id"',
          )
        : undefined;
    } else if (type === "select") {
      const firstValue = field.values?.[0] ?? "default";
      value = (field.maxSelect ?? 1) > 1 ? [firstValue] : firstValue;
    } else {
      value = mockValueForField(
        { name: field.name, type },
        relationIdsByCollectionId,
        { forForm: false, authEnabled: options.features.auth },
      );
    }

    if (value !== undefined) {
      data[field.name] = value;
    }
  }

  return data;
}

function ensureAuthCollectionFixture(data: Record<string, FixtureValue>) {
  data.email = new RawExpression(
    "`test-${Math.random().toString(36).slice(2)}@example.com`",
  );
  data.password = "password";
  data.passwordConfirm = "password";
}

function orderedDependencyCollections(
  collection: Collection | undefined,
  collections: Collection[],
): Collection[] {
  if (!collection) {
    return [];
  }

  const byId = new Map(collections.map((entry) => [entry.id, entry]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const ordered: Collection[] = [];

  const walk = (collectionId: string) => {
    if (visited.has(collectionId) || visiting.has(collectionId)) {
      return;
    }

    const candidate = byId.get(collectionId);
    if (!candidate) {
      return;
    }

    visiting.add(collectionId);
    for (const field of candidate.fields as RuntimeCollectionField[]) {
      if (field.type !== "relation" || !field.collectionId) {
        continue;
      }
      walk(field.collectionId);
    }
    visiting.delete(collectionId);
    visited.add(collectionId);
    ordered.push(candidate);
  };

  for (const field of collection.fields as RuntimeCollectionField[]) {
    if (field.type !== "relation" || !field.collectionId) {
      continue;
    }
    walk(field.collectionId);
  }

  return ordered;
}

function uniqueVarName(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }

  let index = 2;
  while (used.has(`${base}${index}`)) {
    index += 1;
  }

  const name = `${base}${index}`;
  used.add(name);
  return name;
}

function fallbackCollectionFromFields(
  model: Model,
  fields: Field[],
): Collection {
  return {
    id: `generated-${model.tableName}`,
    name: model.tableName,
    type: "base",
    fields: fields.map((field) => {
      if (field.type === "relation") {
        return {
          name: field.name,
          type: field.type,
          collectionId: field.collectionId,
          maxSelect: field.maxSelect,
        };
      }

      if (field.type === "select") {
        return {
          name: field.name,
          type: field.type,
          maxSelect: field.maxSelect,
          values: field.options.map((option) => option.value),
        };
      }

      if (field.type === "file" || field.type === "autodate") {
        return {
          name: field.name,
          type: field.type,
          maxSelect: field.type === "file" ? field.maxSelect : undefined,
        };
      }

      return { name: field.name, type: field.type };
    }),
  };
}

function relationDependencyContext(
  model: Model,
  fields: Field[],
  options: Options,
  collections: Collection[],
) {
  const collection =
    collections.find((entry) => entry.name === model.tableName) ??
    fallbackCollectionFromFields(model, fields);

  const dependencies = orderedDependencyCollections(
    collection,
    collections,
  ).filter((entry) => !(options.features.auth && entry.name === "users"));

  const relationIdsByCollectionId: Record<string, string> = {};
  const dependencyVars: Array<{ varName: string; collection: Collection }> = [];
  const usedVarNames = new Set<string>();

  for (const dependency of dependencies) {
    const varName = uniqueVarName(
      parseModel(dependency.name, options).name,
      usedVarNames,
    );
    dependencyVars.push({ varName, collection: dependency });
    relationIdsByCollectionId[dependency.id] = `${varName}.id`;
  }

  const declarations = dependencyVars.length
    ? `${dependencyVars.map((dependency) => `let ${dependency.varName}: { id: string };`).join("\n")}\n\n`
    : "";

  const setupLines = dependencyVars.map(
    ({ varName, collection: dependency }) => {
      const payload = fixtureDataFromCollectionFields(
        dependency.fields as RuntimeCollectionField[],
        relationIdsByCollectionId,
        options,
      );
      if (dependency.type === "auth") {
        ensureAuthCollectionFixture(payload);
      }
      return `${varName} = await context.admin.collection("${dependency.name}").create(${fixtureObjectToCode(payload)});`;
    },
  );

  const cleanupLines = dependencyVars
    .slice()
    .reverse()
    .map(
      ({ varName, collection: dependency }) =>
        `await context.admin.collection("${dependency.name}").delete(${varName}.id);`,
    );

  const requestAgent = options.features.auth
    ? "context.agent"
    : "context.request";
  const authSetup = options.features.auth
    ? "await context.agent.authenticateUser();\n      "
    : "";

  let setupSection = "";
  if (setupLines.length > 0 || options.features.auth) {
    setupSection += dedent`
      beforeEach(async (context) => {
        ${authSetup}${setupLines.join("\n        ")}
      });
    `;
  }

  if (cleanupLines.length > 0) {
    setupSection +=
      "\n\n" +
      dedent`
        afterEach(async (context) => {
          ${cleanupLines.join("\n          ")}
        });
      `;
  }

  return {
    declarations,
    setupSection,
    requestAgent,
    modelDbData: fixtureObjectToCode(
      fixtureDataFromFields(fields, relationIdsByCollectionId, {
        forForm: false,
        authEnabled: options.features.auth,
      }),
    ),
    modelFormData: fixtureObjectToCode(
      fixtureDataFromFields(fields, relationIdsByCollectionId, {
        forForm: true,
        authEnabled: options.features.auth,
      }),
    ),
  };
}

export function generateScaffoldServerTestSnippet(
  model: Model,
  urls: ScaffoldUrls,
  fields: Field[],
  options: Options,
  collections: Collection[],
): string {
  const {
    declarations,
    setupSection,
    requestAgent,
    modelDbData,
    modelFormData,
  } = relationDependencyContext(model, fields, options, collections);

  return dedent`
    import { afterEach, beforeEach, describe, expect, it } from "vitest";

    describe("${model.pluralName}", () => {
      ${declarations}${setupSection}

      describe("GET ${urls.list}", () => {
        it("should return a 200 status code", async (context) => {
          const response = await ${requestAgent}.get("${urls.list}");
          expect(response.status).toBe(200);
        });
      });

      describe("GET ${urls.new}", () => {
        it("should return a 200 status code", async (context) => {
          const response = await ${requestAgent}.get("${urls.new}");
          expect(response.status).toBe(200);
        });
      });

      describe("POST ${urls.new}", () => {
        it("should create a new ${model.displayName.toLowerCase()}", async (context) => {
          const response = await ${requestAgent}.post("${urls.new}").type("form").send(${modelFormData});
          expect(response.body.status).toBe(303);

          const response2 = await ${requestAgent}.get(response.body.location);
          expect(response2.status).toBe(200);
        });
      });

      describe("GET ${urls.show}", () => {
        it("should return a 200 status code", async (context) => {
          const { id } = await context.admin.collection("${model.tableName}").create(${modelDbData});
          const response = await ${requestAgent}.get(\`${relationUrl(urls.show, "id")}\`);
          expect(response.status).toBe(200);
        });

        it("should return a 404 status code", async (context) => {
          const response = await ${requestAgent}.get("${urls.show.replace("[id]", "non-existent")}");
          expect(response.status).toBe(404);
        });
      });

      describe("POST ${urls.show}", () => {
        it("should delete a ${model.displayName.toLowerCase()}", async (context) => {
          const { id } = await context.admin.collection("${model.tableName}").create(${modelDbData});
          const response = await ${requestAgent}.post(\`${relationUrl(urls.show, "id")}\`).type("form");
          expect(response.body.status).toBe(303);

          const response2 = await ${requestAgent}.get(\`${relationUrl(urls.show, "id")}\`);
          expect(response2.status).toBe(404);
        });
      });

      describe("GET ${urls.edit}", () => {
        it("should return a 200 status code", async (context) => {
          const { id } = await context.admin.collection("${model.tableName}").create(${modelDbData});
          const response = await ${requestAgent}.get(\`${relationUrl(urls.edit, "id")}\`);
          expect(response.status).toBe(200);
        });
      });

      describe("POST ${urls.edit}", () => {
        it("should update a ${model.displayName.toLowerCase()}", async (context) => {
          const { id } = await context.admin.collection("${model.tableName}").create(${modelDbData});
          const response = await ${requestAgent}
            .post(\`${relationUrl(urls.edit, "id")}\`)
            .type("form")
            .send(${modelFormData});
          expect(response.body.status).toBe(303);
          expect(response.body.location).toBe(\`${relationUrl(urls.show, "id")}\`);
        });
      });
    });
  `;
}

export function generateFormServerTestSnippet(
  model: Model,
  formUrl: string,
  fields: Field[],
  options: Options,
  collections: Collection[],
): string {
  const { declarations, setupSection, requestAgent, modelFormData } =
    relationDependencyContext(model, fields, options, collections);

  return dedent`
    import { afterEach, beforeEach, describe, expect, it } from "vitest";

    describe("${formUrl}", () => {
      ${declarations}${setupSection}

      describe("GET ${formUrl}", () => {
        it("should return a 200 status code", async (context) => {
          const response = await ${requestAgent}.get("${formUrl}");
          expect(response.status).toBe(200);
        });
      });

      describe("POST ${formUrl}", () => {
        it("should submit the form successfully", async (context) => {
          const response = await ${requestAgent}.post("${formUrl}").type("form").send(${modelFormData});
          expect(response.body.status).toBe(200);
        });
      });
    });
  `;
}

export function generateFormRemoteServerTestSnippet(
  model: Model,
  formUrl: string,
  fields: Field[],
  options: Options,
  collections: Collection[],
): string {
  const { declarations, setupSection, requestAgent } =
    relationDependencyContext(model, fields, options, collections);

  return dedent`
    import { afterEach, beforeEach, describe, expect, it } from "vitest";

    describe("${formUrl}", () => {
      ${declarations}${setupSection}

      describe("GET ${formUrl}", () => {
        it("should return a 200 status code", async (context) => {
          const response = await ${requestAgent}.get("${formUrl}");
          expect(response.status).toBe(200);
        });
      });
    });
  `;
}
