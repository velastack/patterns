import * as changeCase from "change-case";
import dedent from "dedent";
import pluralize from "pluralize";
import type { CollectionFieldSpec, CollectionSpec, Options } from "./types";
import {
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

const TYPE_ALIASES: Record<string, Field["type"]> = {
  string: "text",
  boolean: "bool",
  geopoint: "geoPoint",
  references: "relation",
  integer: "number",
  int: "number",
  float: "number",
  decimal: "number",
  double: "number",
  datetime: "date",
  timestamp: "date",
  text: "text",
  number: "number",
  bool: "bool",
  date: "date",
  email: "email",
  password: "password",
  url: "url",
  editor: "editor",
  autodate: "autodate",
  select: "select",
  file: "file",
  json: "json",
  geoPoint: "geoPoint",
  relation: "relation",
};

function escapeFieldName(fieldName: string): string {
  const validIdentifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
  return validIdentifierRegex.test(fieldName) ? fieldName : `'${fieldName}'`;
}

function zodSchemaForField(
  field: SchemaField,
  options: { forForm: boolean },
): string {
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
      schema = "z.any()";
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
  options: Pick<Options, "env" | "features">,
): Promise<Collection[]> {
  if (options.env === "runtime") {
    const { getCollections } = await import("../parse/env.runtime");
    return (await getCollections()) as Collection[];
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
  const model = parseModel(modelPath, options);
  const collections = await loadCollections(options);

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

  const fields = fieldsFromCollection(model, collections, options);
  return {
    model,
    fields,
    auth: undefined,
    shouldCreateCollection: false,
    collections,
  };
}

export function generateSchemaSnippet(
  model: Pick<Model, "schemaName" | "tableName">,
  fields: Field[],
  options: { includeModelFields: boolean; forForm: boolean },
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
  const normalized = TYPE_ALIASES[type];
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
      const relatedModel = parseModel(relatedCollection.name, options);
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
        onCreate: raw.onCreate ?? raw.name.includes("create"),
        onUpdate: raw.onUpdate ?? raw.name.includes("update"),
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

export function routeWithId(
  routeSegment: string,
  idExpression: string,
): string {
  return `/${routeSegment}/\${${idExpression}}`;
}

export function inferModelCollectionName(name: string): string {
  return pluralize.plural(changeCase.snakeCase(name));
}

function toCollectionFieldSpec(field: Field): CollectionFieldSpec {
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

export function collectionSpecFromModelFields(
  model: Pick<Model, "tableName">,
  fields: Field[],
  auth?: OwnershipResult,
): CollectionSpec {
  const rules = auth
    ? {
        listRule: auth.rule,
        viewRule: auth.rule,
        createRule: auth.rule,
        updateRule: auth.rule,
        deleteRule: auth.rule,
      }
    : {};

  return {
    name: model.tableName,
    type: "base",
    ...rules,
    fields: fields.map(toCollectionFieldSpec),
  };
}
