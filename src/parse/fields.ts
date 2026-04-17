import * as changeCase from "change-case";
import pluralize from "pluralize";
import { InvalidArgumentError } from "../core/errors";
import type { Options } from "../core/types";
import {
  collectionDisplayFieldMap,
  collectionIdMap,
  collectionNames,
} from "./collections";
import { parseModel } from "./model";
import { generateAuthRule } from "./permissions";
import type { Collection, Field, Model, OwnershipResult } from "./types";

export function splitFieldDef(definition: string): [string, string] {
  let inQuote: '"' | "'" | null = null;
  let escape = false;
  let parenDepth = 0;
  for (let i = 0; i < definition.length; i++) {
    const ch = definition[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inQuote) {
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === inQuote) {
        inQuote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
      continue;
    }
    if (ch === "(") {
      parenDepth++;
      continue;
    }
    if (ch === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }
    if (ch === ":" && parenDepth === 0) {
      return [definition.slice(0, i), definition.slice(i + 1)];
    }
  }
  return [definition, ""];
}

function stripQuotes(s: string): string {
  const t = s.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1).replace(/\\(["'])/g, "$1");
  }
  return t;
}

function parseOptionToken(token: string): { label: string; value: string } {
  let colonIndex = -1;
  let inQuote: '"' | "'" | null = null;
  let escape = false;
  for (let j = 0; j < token.length; j++) {
    const ch = token[j];
    if (escape) {
      escape = false;
      continue;
    }
    if (inQuote) {
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === inQuote) {
        inQuote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
      continue;
    }
    if (ch === ":") {
      colonIndex = j;
      break;
    }
  }

  let value: string;
  let label: string;
  if (colonIndex >= 0) {
    value = token.slice(0, colonIndex).trim();
    label = token.slice(colonIndex + 1).trim();
  } else {
    value = token.trim();
    label = value;
  }
  return { label: stripQuotes(label), value: stripQuotes(value) };
}

export function parseSelectOptions(
  options: string,
): Array<{ label: string; value: string }> {
  const result: Array<{ label: string; value: string }> = [];
  let current = "";
  let inQuote: '"' | "'" | null = null;
  let escape = false;

  for (let i = 0; i < options.length; i++) {
    const ch = options[i];

    if (escape) {
      current += ch;
      escape = false;
      continue;
    }

    if (inQuote) {
      if (ch === "\\") {
        escape = true;
        current += ch;
        continue;
      }
      if (ch === inQuote) {
        inQuote = null;
        current += ch;
        continue;
      }
      current += ch;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inQuote = ch;
      current += ch;
      continue;
    }

    if (ch === ",") {
      const token = current.trim();
      if (token.length > 0) {
        result.push(parseOptionToken(token));
      }
      current = "";
      continue;
    }

    current += ch;
  }

  const last = current.trim();
  if (last.length > 0) {
    result.push(parseOptionToken(last));
  }

  return result;
}

const TYPE_ALIASES: Record<string, string> = {
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
};

interface NormalizedType {
  type: string;
  required: boolean;
  selectOptions: Array<{ label: string; value: string }>;
}

function normalizeType(rawType: string): NormalizedType {
  const required = rawType.endsWith("!");
  let type = required ? rawType.slice(0, -1) : rawType;
  let selectOptions: Array<{ label: string; value: string }> = [];

  if (type.startsWith("select(") && type.endsWith(")")) {
    const inner = type.slice(7, -1);
    selectOptions = parseSelectOptions(inner);
    type = "select";
  }

  if (type === "files") {
    return { type: "file", required, selectOptions };
  }

  if (type in TYPE_ALIASES) {
    type = TYPE_ALIASES[type];
  }

  return { type, required, selectOptions };
}

function inferMaxSelect(name: string): number {
  const singular = pluralize.singular(name);
  const plural = pluralize.plural(singular);
  return name === plural ? 99 : 1;
}

function resolveRelation(
  name: string,
  collectionName: string,
  parent: Model,
  ids: Record<string, string>,
  displayFields: Record<string, string>,
  options: Pick<Options, "features">,
): {
  collectionId: string;
  displayField: string;
  relatedModel: Model;
  singularRelationName: string;
  pluralRelationName: string;
  maxSelect: number;
} {
  const relatedModel = parseModel(collectionName, options);
  const singular = pluralize.singular(name);
  const plural = pluralize.plural(singular);
  return {
    collectionId: ids[collectionName],
    displayField: displayFields[collectionName] ?? "id",
    relatedModel,
    singularRelationName: changeCase.camelCase(
      `${parent.displayName} ${relatedModel.displayName}`,
    ),
    pluralRelationName: changeCase.camelCase(
      `${parent.displayName} ${relatedModel.pluralDisplayName}`,
    ),
    maxSelect: name === plural ? 999 : 1,
  };
}

function resolveField(
  name: string,
  normalized: NormalizedType,
  parent: Model,
  collections: Collection[],
  options: Pick<Options, "features">,
): Field {
  const title = changeCase.capitalCase(name);
  const { type, required, selectOptions } = normalized;
  const names = collectionNames(collections);
  const ids = collectionIdMap(collections);
  const displayFields = collectionDisplayFieldMap(collections);
  const namesSingular = names.map((c) => pluralize.singular(c));

  // current_user: special auth-mode relation to users
  if (options.features.auth && type === "current_user" && ids["users"]) {
    const rel = resolveRelation(
      name,
      "users",
      parent,
      ids,
      displayFields,
      options,
    );
    return {
      type: "relation",
      name,
      title,
      required,
      collectionId: rel.collectionId,
      maxSelect: 1,
      displayField: rel.displayField,
      relatedModel: rel.relatedModel,
      singularRelationName: rel.singularRelationName,
      pluralRelationName: rel.pluralRelationName,
      isCurrentUser: true,
    };
  }

  // autodate
  if (type === "autodate") {
    const onCreate = name.includes("create");
    const onUpdate = name.includes("update");
    if (!onCreate && !onUpdate) {
      throw new InvalidArgumentError(
        `Invalid autodate field: ${name}. Must be one of created/created_at/updated/updated_at.`,
      );
    }
    return { type: "autodate", name, title, required, onCreate, onUpdate };
  }

  // select with inline options
  if (type === "select") {
    return {
      type: "select",
      name,
      title,
      required,
      maxSelect: inferMaxSelect(name),
      options: selectOptions,
    };
  }

  // file / files
  if (type === "file") {
    return {
      type: "file",
      name,
      title,
      required,
      maxSelect: inferMaxSelect(name),
    };
  }

  // relation via `name:relation` or `name:references`
  if (type === "relation") {
    const singular = pluralize.singular(name);
    const plural = pluralize.plural(singular);
    if (!names.includes(plural)) {
      throw new InvalidArgumentError(
        `Invalid relation field: ${name}. Must be one of ${names.join(", ")} (singular or plural)`,
      );
    }
    const rel = resolveRelation(
      name,
      plural,
      parent,
      ids,
      displayFields,
      options,
    );
    return {
      type: "relation",
      name,
      title,
      required,
      ...rel,
      isCurrentUser: false,
    };
  }

  // relation via collection name as type: `owners:users` or `owner:user`
  if (names.includes(type)) {
    const rel = resolveRelation(
      name,
      type,
      parent,
      ids,
      displayFields,
      options,
    );
    return {
      type: "relation",
      name,
      title,
      required,
      ...rel,
      isCurrentUser: false,
    };
  }
  if (namesSingular.includes(type)) {
    const plural = pluralize.plural(type);
    if (names.includes(plural)) {
      const rel = resolveRelation(
        name,
        plural,
        parent,
        ids,
        displayFields,
        options,
      );
      return {
        type: "relation",
        name,
        title,
        required,
        collectionId: rel.collectionId,
        displayField: rel.displayField,
        relatedModel: rel.relatedModel,
        singularRelationName: rel.singularRelationName,
        pluralRelationName: rel.pluralRelationName,
        maxSelect: 1,
        isCurrentUser: false,
      };
    }
  }

  // Validate that it's a known simple type
  const allValidTypes = [
    ...new Set([
      "text",
      "number",
      "bool",
      "date",
      "email",
      "password",
      "url",
      "editor",
      "json",
      "geoPoint",
      "autodate",
      "select",
      "file",
      "relation",
      ...(options.features.auth ? ["current_user"] : []),
      ...names,
    ]),
  ];
  if (
    !(
      [
        "text",
        "number",
        "bool",
        "date",
        "email",
        "password",
        "url",
        "editor",
        "json",
        "geoPoint",
      ] as string[]
    ).includes(type)
  ) {
    throw new InvalidArgumentError(
      `Invalid field type: ${type}. Valid types are: ${allValidTypes.join(", ").replace("relation", "references")}`,
    );
  }

  return { type: type as Field["type"], name, title, required } as Field;
}

export function resolveFields(
  fields: string[],
  parent: Model,
  collections: Collection[],
  options: Pick<Options, "features">,
): { fields: Field[]; auth: OwnershipResult | undefined } {
  const parsed: Field[] = [];

  for (const fieldDef of fields) {
    const [name, rawType] = splitFieldDef(fieldDef);

    if (!name || !rawType) {
      throw new InvalidArgumentError(
        `Invalid field format: ${fieldDef}. Expected format: name:type or name:type!`,
      );
    }

    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(name)) {
      throw new InvalidArgumentError(
        `Invalid field name: ${name}. Must start with a letter and contain only alphanumeric characters`,
      );
    }

    const normalized = normalizeType(rawType);
    parsed.push(resolveField(name, normalized, parent, collections, options));
  }

  const auth = options.features.auth
    ? generateAuthRule(
        [
          ...collections,
          {
            id: "new",
            name: parent.tableName,
            type: "base",
            fields: parsed.map((f) => ({
              name: f.name,
              type: f.type,
              collectionId: f.type === "relation" ? f.collectionId : undefined,
              maxSelect: "maxSelect" in f ? f.maxSelect : undefined,
            })),
          },
        ],
        parent.tableName,
      )
    : undefined;

  return { fields: parsed, auth };
}

export async function parseFields(
  fields: string[],
  parent: Model,
  options: Pick<Options, "env" | "features">,
): Promise<{ fields: Field[]; auth: OwnershipResult | undefined }> {
  let collections: Collection[];
  if (options.env === "runtime") {
    const { getCollections } = await import("./env.runtime");
    collections = await getCollections();
  } else {
    const { getPreviewCollections } = await import("./env.preview");
    collections = getPreviewCollections(options);
  }
  return resolveFields(fields, parent, collections, options);
}
