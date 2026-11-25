import * as changeCase from "change-case";
import dedent from "dedent";
import pluralize from "pluralize";
import { InvalidArgumentError } from "./errors";
import type { CollectionFieldSpec, CollectionSpec, Options } from "./types";
import {
  FIELD_TYPES,
  autodateFlags,
  collectionDisplayFieldMap,
  parseModel,
  resolveFields,
  validateModelName,
  type Collection,
  type Field,
  type Model,
  type OwnershipResult,
} from "../parse";

interface RuntimeCollectionField {
  name: string;
  type: string;
  required?: boolean;
  system?: boolean;
  collectionId?: string;
  maxSelect?: number;
  values?: string[];
  onCreate?: boolean;
  onUpdate?: boolean;
}

interface SchemaField {
  name: string;
  type: Field["type"];
  required: boolean;
  maxSelect?: number;
  options?: Array<{ label: string; value: string }>;
  collectionId?: string;
  onCreate?: boolean;
  onUpdate?: boolean;
}

const NON_EMPTY_FIELDS: Field["type"][] = ["text"];

/** A collection field's type, under any spelling the field syntax takes. */
const TYPE_ALIASES = Object.fromEntries(
  FIELD_TYPES.flatMap(({ type, aliases }) =>
    [type, ...aliases].map((name) => [name, type]),
  ),
) as Record<string, Field["type"]>;

function escapeFieldName(fieldName: string): string {
  const validIdentifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
  return validIdentifierRegex.test(fieldName) ? fieldName : `'${fieldName}'`;
}

export interface SchemaOptions {
  forForm: boolean;
  /**
   * The schema backs a remote form, whose `fields.x.as(...)` exists only on
   * fields typed as form values: a `z.any()` json field would be an
   * `UnknownField` with no `.as()`.
   */
  remote?: boolean;
}

function zodSchemaForField(field: SchemaField, options: SchemaOptions): string {
  const selectValues =
    field.type === "select"
      ? `[${(field.options ?? []).map((option) => JSON.stringify(option.value)).join(", ")}]`
      : "";

  let schema: string;
  switch (field.type) {
    case "text":
      schema = "z.string()";
      break;
    case "number":
      schema = "z.number()";
      break;
    case "bool":
      schema = "z.boolean().default(false)";
      break;
    case "date":
      schema = options.forForm ? "z.string()" : "z.date()";
      break;
    case "email":
      schema = "z.email()";
      break;
    case "password":
      schema = "z.string()";
      break;
    case "url":
      schema = "z.url()";
      break;
    case "editor":
      schema = "z.string()";
      break;
    case "autodate":
      schema = options.forForm ? "z.string()" : "z.date()";
      break;
    case "select":
      if (selectValues) {
        schema =
          (field.maxSelect ?? 1) > 1
            ? `z.array(z.enum(${selectValues}))`
            : `z.enum(${selectValues})`;
      } else {
        schema = "z.string()";
      }
      break;
    case "file":
      schema =
        (field.maxSelect ?? 1) > 1
          ? "z.string().array()"
          : "z.union([z.instanceof(File), z.string()])";
      break;
    case "json":
      // The remote form's textarea posts the JSON as text.
      schema = options.remote ? "z.string()" : "z.any()";
      break;
    case "geoPoint":
      schema = options.forForm
        ? `z.preprocess((val) => {
  if (typeof val === "string") {
    return val;
  }
  return JSON.stringify(val);
}, z.string()${field.required ? "" : ".optional()"})`
        : dedent`
            z.object({
              lat: z.number().min(-90).max(90),
              lon: z.number().min(-180).max(180)
            })
          `;
      break;
    case "relation":
      schema =
        (field.maxSelect ?? 1) > 1 ? "z.array(z.string())" : "z.string()";
      break;
    default: {
      const exhaustiveType: never = field.type;
      return exhaustiveType;
    }
  }

  if (NON_EMPTY_FIELDS.includes(field.type)) {
    return field.required ? `${schema}.nonempty()` : `${schema}.optional()`;
  }

  if (field.required) {
    return schema;
  }

  if (field.type === "geoPoint") {
    return schema;
  }

  if (field.type === "file" && (field.maxSelect ?? 1) <= 1) {
    return `${schema}.optional().default("")`;
  }

  return `${schema}.optional()`;
}

export async function loadCollections(
  options: Pick<Options, "env" | "features" | "getCollections">,
): Promise<Collection[]> {
  if (options.env === "runtime") {
    if (!options.getCollections) {
      throw new Error(
        'A `getCollections` provider is required when env is "runtime". ' +
          "It is supplied by the vela CLI; upgrade to vela >= 0.10.0.",
      );
    }
    return (await options.getCollections()) as Collection[];
  }
  const { getPreviewCollections } = await import("../parse/env.preview");
  return getPreviewCollections(options);
}

export interface ResolvedInput {
  model: Model;
  fields: Field[];
  auth: OwnershipResult | undefined;
  shouldCreateCollection: boolean;
  collections: Collection[];
}

export async function resolveInputFields(
  options: Options,
  modelPath: string,
  fieldDefs: string[],
): Promise<ResolvedInput> {
  validateModelName(modelPath);
  const model = parseModel(modelPath);
  const collections = options.features.backend
    ? await loadCollections(options)
    : [];

  if (fieldDefs.length > 0) {
    const { fields, auth } = resolveFields(
      fieldDefs,
      model,
      collections,
      options,
    );
    return {
      model,
      fields,
      auth,
      shouldCreateCollection: true,
      collections,
    };
  }

  if (!options.features.backend) {
    throw new InvalidArgumentError(
      "Cannot derive fields from a collection without a backend. Pass field definitions (e.g. `name:text email:email`) or run `vela enable backend` first.",
    );
  }

  const fields = fieldsFromCollection(model, collections, options);
  return {
    model,
    fields,
    auth: undefined,
    shouldCreateCollection: false,
    collections,
  };
}

/**
 * The keys a list of fields has in a zod object, in order. A multi-file field
 * has three: its own (the filenames kept), `name+` (uploads) and `name-`
 * (filenames to drop), which is how PocketBase takes them.
 */
export function schemaEntriesForFields(
  fields: Field[],
  options: SchemaOptions,
): Array<{ name: string; schema: string }> {
  const entries: Array<{ name: string; schema: string }> = [];

  for (const field of fields) {
    if (field.type === "file" && field.maxSelect > 1) {
      entries.push({
        name: field.name,
        schema: zodSchemaForField({ ...field, required: false }, options),
      });
      entries.push({
        name: `${field.name}+`,
        schema: "z.instanceof(File).array().optional()",
      });
      entries.push({
        name: `${field.name}-`,
        schema: "z.string().array().optional()",
      });
      continue;
    }
    entries.push({
      name: field.name,
      schema: zodSchemaForField(field, options),
    });
  }

  return entries;
}

export function generateSchemaSnippet(
  model: Pick<Model, "schemaName" | "tableName">,
  fields: Field[],
  options: SchemaOptions & { includeModelFields: boolean },
): string {
  const entries: Array<{ name: string; schema: string }> = [];

  if (options.includeModelFields) {
    entries.push({
      name: "id",
      schema: zodSchemaForField(
        { name: "id", type: "text", required: false },
        options,
      ),
    });
    entries.push({
      name: "collectionId",
      schema: zodSchemaForField(
        { name: "collectionId", type: "text", required: false },
        options,
      ),
    });
  }

  entries.push(...schemaEntriesForFields(fields, options));

  const schemaFields = entries
    .map((entry) => `${escapeFieldName(entry.name)}: ${entry.schema}`)
    .join(",\n  ");

  const modelTypeImport = options.includeModelFields
    ? '\nimport type { Schemas } from "@velastack/pocketbase";'
    : "";
  const modelSatisfies = options.includeModelFields
    ? ` satisfies Schemas["${model.tableName}"]`
    : "";

  return dedent`
    import { z } from "zod";${modelTypeImport}

    export const ${model.schemaName} = z.object({
      ${schemaFields}
    })${modelSatisfies};
  `;
}

function normalizeType(type: string): Field["type"] {
  const normalized = Object.prototype.hasOwnProperty.call(TYPE_ALIASES, type)
    ? TYPE_ALIASES[type]
    : undefined;
  if (!normalized) {
    throw new Error(
      `Unsupported collection field type "${type}" when generating from collection`,
    );
  }
  return normalized;
}

export function fieldsFromCollection(
  model: Model,
  collections: Collection[],
  options: Pick<Options, "features">,
): Field[] {
  const collection = collections.find((item) => item.name === model.tableName);
  if (!collection) {
    throw new Error(`Collection "${model.tableName}" not found`);
  }

  const displayFields = collectionDisplayFieldMap(collections);
  const collectionById = new Map(collections.map((item) => [item.id, item]));

  const resolvedFields: Field[] = [];
  for (const raw of collection.fields as RuntimeCollectionField[]) {
    if (raw.name === "id" || raw.system) {
      continue;
    }
    // PocketBase stamps these itself: they are no more a form input, a schema
    // key or a fixture value than `id` is.
    if (raw.type === "autodate" && isTimestampName(raw.name)) {
      continue;
    }

    const type = normalizeType(raw.type);
    const required = Boolean(raw.required);
    const title = changeCase.capitalCase(raw.name);

    if (type === "relation") {
      const relatedCollection = raw.collectionId
        ? collectionById.get(raw.collectionId)
        : undefined;
      if (!relatedCollection) {
        continue;
      }
      const relatedModel = parseModel(relatedCollection.name);
      resolvedFields.push({
        name: raw.name,
        title,
        type: "relation",
        required,
        collectionId: relatedCollection.id,
        maxSelect: raw.maxSelect ?? 1,
        displayField: displayFields[relatedCollection.name] ?? "id",
        relatedModel,
        singularRelationName: changeCase.camelCase(
          `${model.displayName} ${relatedModel.displayName}`,
        ),
        pluralRelationName: changeCase.camelCase(
          `${model.displayName} ${relatedModel.pluralDisplayName}`,
        ),
        isCurrentUser:
          options.features.auth &&
          relatedCollection.name === "users" &&
          /user|owner|author/i.test(raw.name),
        isCurrentTeam:
          options.features.teams &&
          relatedCollection.name === "teams" &&
          /team/i.test(raw.name),
      });
      continue;
    }

    if (type === "select") {
      resolvedFields.push({
        name: raw.name,
        title,
        type: "select",
        required,
        maxSelect: raw.maxSelect ?? 1,
        options: (raw.values ?? []).map((value) => ({ label: value, value })),
      });
      continue;
    }

    if (type === "file") {
      resolvedFields.push({
        name: raw.name,
        title,
        type: "file",
        required,
        maxSelect: raw.maxSelect ?? 1,
      });
      continue;
    }

    if (type === "autodate") {
      resolvedFields.push({
        name: raw.name,
        title,
        type: "autodate",
        required,
        onCreate: raw.onCreate ?? autodateFlags(raw.name)?.onCreate ?? false,
        onUpdate: raw.onUpdate ?? autodateFlags(raw.name)?.onUpdate ?? false,
      });
      continue;
    }

    resolvedFields.push({
      name: raw.name,
      title,
      type,
      required,
    } as Field);
  }

  return resolvedFields.filter((field) => field.name !== "id");
}

export function inferPrimaryField(fields: Field[]): Field | undefined {
  const preferred = ["title", "name", "label", "email", "id"];
  for (const name of preferred) {
    const field = fields.find((item) => item.name === name);
    if (field) return field;
  }
  return fields[0];
}

export function relationExpandParam(fields: Field[]): string | undefined {
  const names = fields
    .filter(
      (field): field is Extract<Field, { type: "relation" }> =>
        field.type === "relation",
    )
    .map((field) => field.name);
  return names.length > 0 ? names.join(",") : undefined;
}

export function uniqueRelationCollections(
  fields: Field[],
): Array<Extract<Field, { type: "relation" }>["relatedModel"]> {
  const seen = new Set<string>();
  const models: Array<Extract<Field, { type: "relation" }>["relatedModel"]> =
    [];

  for (const field of fields) {
    if (field.type !== "relation") continue;
    if (seen.has(field.relatedModel.tableName)) continue;
    seen.add(field.relatedModel.tableName);
    models.push(field.relatedModel);
  }

  return models;
}

/**
 * `load` statements fetching every collection the relation fields point at.
 * The relation field renderers read them as `data.<pluralName>`.
 */
export function relationLoadLines(fields: Field[], pbInstance: string): string {
  return uniqueRelationCollections(fields)
    .map(
      (relatedModel) =>
        `const ${relatedModel.pluralName} = await ${pbInstance}.collection("${relatedModel.tableName}").getFullList();`,
    )
    .join("\n\t\t\t");
}

export function relationLoadReturnVars(fields: Field[]): string {
  return uniqueRelationCollections(fields)
    .map((relatedModel) => relatedModel.pluralName)
    .join(", ");
}

export function routeWithId(baseUrl: string, idExpression: string): string {
  return `/${baseUrl}/\${${idExpression}}`;
}

export function inferModelCollectionName(name: string): string {
  return pluralize.plural(changeCase.snakeCase(name));
}

export function toCollectionFieldSpec(field: Field): CollectionFieldSpec {
  const base = {
    name: field.name,
    type: field.type,
    required: field.required,
  } satisfies CollectionFieldSpec;

  if (field.type === "relation") {
    return {
      ...base,
      collectionId: field.collectionId,
      maxSelect: field.maxSelect,
    };
  }

  if (field.type === "file") {
    return {
      ...base,
      maxSelect: field.maxSelect,
    };
  }

  if (field.type === "select") {
    return {
      ...base,
      maxSelect: field.maxSelect,
      values: field.options.map((option) => option.value),
    };
  }

  if (field.type === "autodate") {
    return {
      ...base,
      onCreate: field.onCreate,
      onUpdate: field.onUpdate,
    };
  }

  return base;
}

/**
 * The two autodate fields PocketBase's own admin UI adds to every new
 * collection. Without them `sort: "-created"` fails at runtime.
 */
const TIMESTAMP_FIELDS: CollectionFieldSpec[] = [
  { name: "created", type: "autodate", onCreate: true, onUpdate: false },
  { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
];

function isTimestampName(name: string): boolean {
  return TIMESTAMP_FIELDS.some((field) => field.name === name);
}

/** What `input.rules` takes. */
export const RULES_MODES = ["auth", "owner", "superuser"] as const;

export type RulesMode = (typeof RULES_MODES)[number];

const SIGNED_IN_RULE = '@request.auth.id != ""';

/**
 * `input.rules`, checked. Thrown here rather than at the PocketBase call, so
 * a bad value stops the run before anything is written.
 */
export function rulesModeFromInput(
  options: Pick<Options, "features" | "input">,
): RulesMode | undefined {
  const value: unknown = options.input?.rules;
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (!(RULES_MODES as readonly unknown[]).includes(value)) {
    throw new InvalidArgumentError(
      `Invalid rules: ${JSON.stringify(value)}. Valid values are: ${RULES_MODES.join(", ")}`,
    );
  }
  const mode = value as RulesMode;
  if (mode !== "superuser" && !options.features.auth) {
    throw new InvalidArgumentError(
      `Rules "${mode}" need the auth feature. Run \`vela enable auth\` first, or use "superuser" to keep the collection to the server's superuser client.`,
    );
  }
  return mode;
}

type CollectionRules = Pick<
  CollectionSpec,
  "listRule" | "viewRule" | "createRule" | "updateRule" | "deleteRule"
>;

function allRules(rule: string | null): CollectionRules {
  return {
    listRule: rule,
    viewRule: rule,
    createRule: rule,
    updateRule: rule,
    deleteRule: rule,
  };
}

/**
 * The five API rules of a new collection.
 *
 * Without a mode: the owner rule when a relation path leads to `users`, any
 * signed-in user otherwise, and no rules at all (superuser only) in a project
 * without auth. A mode picks one of those outright.
 */
function collectionRules(
  model: Pick<Model, "tableName">,
  auth: OwnershipResult | undefined,
  mode: RulesMode | undefined,
): CollectionRules {
  switch (mode) {
    case undefined:
      return auth ? allRules(auth.rule) : {};
    case "auth":
      return allRules(SIGNED_IN_RULE);
    case "superuser":
      return allRules(null);
    case "owner":
      if (!auth || auth.ownershipChainFields.length === 0) {
        throw new InvalidArgumentError(
          `Rules "owner" need a relation from "${model.tableName}" to users, directly or through another collection, and none of its fields has one. Add one (for example \`user:current_user\`), or use rules "auth".`,
        );
      }
      return allRules(auth.rule);
  }
}

/**
 * What to tell the user about the rules a collection was created with, for
 * `Result.notes`. Only "superuser" needs saying: nothing reaches the
 * collection through `locals.pb`.
 */
export function rulesNotes(
  model: Pick<Model, "tableName">,
  mode: RulesMode | undefined,
): string[] {
  if (mode !== "superuser") return [];
  return [
    `"${model.tableName}" has no API rules: only the superuser client can read or write it. Use \`locals.admin\` on the server; \`locals.pb\` and the browser get nothing.`,
  ];
}

/**
 * `input.rules` for a generator about to create a collection, or not: rules
 * are set as the collection is created, so asking for them when it already
 * exists is refused rather than silently dropped.
 */
export function rulesModeForCreate(
  options: Pick<Options, "features" | "input">,
  model: Pick<Model, "tableName">,
  shouldCreateCollection: boolean,
): RulesMode | undefined {
  const mode = rulesModeFromInput(options);
  if (mode && !shouldCreateCollection) {
    throw new InvalidArgumentError(
      `Rules are set when a collection is created, and "${model.tableName}" is not being created. Leave rules out, and change the collection's rules in a migration.`,
    );
  }
  return mode;
}

function uniqueIndex(tableName: string, fieldName: string): string {
  return `CREATE UNIQUE INDEX \`idx_${tableName}_${fieldName}\` ON \`${tableName}\` (\`${fieldName}\`)`;
}

/** One `CREATE UNIQUE INDEX` per field declared `name:type:unique`. */
export function uniqueIndexes(
  model: Pick<Model, "tableName">,
  fields: Field[],
): string[] {
  return fields
    .filter((field) => field.unique)
    .map((field) => uniqueIndex(model.tableName, field.name));
}

/**
 * The spec of a new collection. `created` and `updated` are added here and
 * nowhere else: they belong to the collection, not to the fields a generator
 * renders, so no schema, form, page or fixture sees them. A field the user
 * named `created` or `updated` is kept as they declared it.
 */
export function collectionSpecFromModelFields(
  model: Pick<Model, "tableName">,
  fields: Field[],
  auth?: OwnershipResult,
  rules?: RulesMode,
): CollectionSpec {
  const declared = new Set(fields.map((field) => field.name));
  const timestamps = TIMESTAMP_FIELDS.filter(
    (field) => !declared.has(field.name),
  );

  const indexes = uniqueIndexes(model, fields);

  return {
    name: model.tableName,
    type: "base",
    ...collectionRules(model, auth, rules),
    fields: [...fields.map(toCollectionFieldSpec), ...timestamps],
    ...(indexes.length > 0 ? { indexes } : {}),
  };
}
