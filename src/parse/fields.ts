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
import {
  FIELD_MODIFIERS,
  FIELD_NAME_PATTERN,
  FIELD_NAME_RULE,
  FIELD_TYPES,
  TYPE_ALIASES,
  type FieldModifier,
} from "./syntax";
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

/**
 * `name:type[:modifier...]` split at every colon outside parentheses and
 * quotes, so the colons of `select(value:Label)` stay in the type.
 */
export function splitFieldParts(definition: string): {
  name: string;
  type: string;
  modifiers: string[];
} {
  const [name, rest] = splitFieldDef(definition);
  const [type, tail] = splitFieldDef(rest);
  const modifiers: string[] = [];
  let remaining = tail;
  while (remaining !== "") {
    const [modifier, next] = splitFieldDef(remaining);
    modifiers.push(modifier);
    remaining = next;
  }
  return { name, type, modifiers };
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

/**
 * When an autodate field is stamped, going by its name. PocketBase's own
 * `created` is set on create only and its `updated` on create and on every
 * update, so a fresh record has both. `undefined` when the name says neither.
 */
export function autodateFlags(
  name: string,
): { onCreate: boolean; onUpdate: boolean } | undefined {
  const lower = name.toLowerCase();
  const onUpdate = lower.includes("update");
  const onCreate = onUpdate || lower.includes("create");
  return onCreate ? { onCreate, onUpdate } : undefined;
}

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

  if (Object.prototype.hasOwnProperty.call(TYPE_ALIASES, type)) {
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
): {
  collectionId: string;
  displayField: string;
  relatedModel: Model;
  singularRelationName: string;
  pluralRelationName: string;
  maxSelect: number;
} {
  const relatedModel = parseModel(collectionName);
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

/** Types with nothing to resolve: the field is its name, type and `required`. */
const SIMPLE_TYPES: string[] = [
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
];

/**
 * A unique index needs one comparable value per record. These hold a JSON
 * document, a hash or a timestamp instead.
 */
const NOT_UNIQUE_TYPES: Field["type"][] = [
  "json",
  "geoPoint",
  "file",
  "password",
  "autodate",
  "bool",
];

function applyModifiers(
  field: Field,
  modifiers: string[],
  fieldDef: string,
): Field {
  for (const modifier of modifiers) {
    if (!(FIELD_MODIFIERS as readonly string[]).includes(modifier)) {
      throw new InvalidArgumentError(
        `Invalid field modifier: "${modifier}" in ${fieldDef}. Valid modifiers are: ${FIELD_MODIFIERS.join(", ")} (written name:type:modifier)`,
      );
    }
    if ((modifier as FieldModifier) === "unique") {
      if (NOT_UNIQUE_TYPES.includes(field.type)) {
        throw new InvalidArgumentError(
          `Invalid field modifier: a ${field.type} field cannot be unique (${fieldDef})`,
        );
      }
      if ("maxSelect" in field && field.maxSelect > 1) {
        throw new InvalidArgumentError(
          `Invalid field modifier: "${field.name}" holds several values, so it cannot be unique (${fieldDef})`,
        );
      }
      field.unique = true;
    }
  }
  return field;
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
  // Always required: the server injects locals.pb.authStore.record?.id on create.
  if (type === "current_user") {
    if (!options.features.auth) {
      throw new InvalidArgumentError(
        `Field type "current_user" requires the auth feature. Run \`vela enable auth\` to enable it.`,
      );
    }
    if (!ids["users"]) {
      throw new InvalidArgumentError(
        `Field type "current_user" requires a "users" collection but none was found.`,
      );
    }
    const rel = resolveRelation(name, "users", parent, ids, displayFields);
    return {
      type: "relation",
      name,
      title,
      required: true,
      collectionId: rel.collectionId,
      maxSelect: 1,
      displayField: rel.displayField,
      relatedModel: rel.relatedModel,
      singularRelationName: rel.singularRelationName,
      pluralRelationName: rel.pluralRelationName,
      isCurrentUser: true,
      isCurrentTeam: false,
    };
  }

  // current_team: special teams-mode relation to teams
  // Always required: the server injects locals.team on create.
  if (type === "current_team") {
    if (!options.features.teams) {
      throw new InvalidArgumentError(
        `Field type "current_team" requires the teams feature. Run \`vela enable teams\` to enable it.`,
      );
    }
    if (!ids["teams"]) {
      throw new InvalidArgumentError(
        `Field type "current_team" requires a "teams" collection but none was found.`,
      );
    }
    const rel = resolveRelation(name, "teams", parent, ids, displayFields);
    return {
      type: "relation",
      name,
      title,
      required: true,
      collectionId: rel.collectionId,
      maxSelect: 1,
      displayField: rel.displayField,
      relatedModel: rel.relatedModel,
      singularRelationName: rel.singularRelationName,
      pluralRelationName: rel.pluralRelationName,
      isCurrentUser: false,
      isCurrentTeam: true,
    };
  }

  // autodate
  if (type === "autodate") {
    const flags = autodateFlags(name);
    if (!flags) {
      throw new InvalidArgumentError(
        `Invalid autodate field: ${name}. The name says when the field is set, so it has to hold "create" or "update": created, created_at, updated, updated_at.`,
      );
    }
    return { type: "autodate", name, title, required, ...flags };
  }

  // select with inline options; PocketBase refuses a maxSelect above the
  // number of values.
  if (type === "select") {
    return {
      type: "select",
      name,
      title,
      required,
      maxSelect: Math.max(
        1,
        Math.min(inferMaxSelect(name), selectOptions.length),
      ),
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
    const rel = resolveRelation(name, plural, parent, ids, displayFields);
    return {
      type: "relation",
      name,
      title,
      required,
      ...rel,
      isCurrentUser: false,
      isCurrentTeam: false,
    };
  }

  // relation via collection name as type: `owners:users` or `owner:user`
  if (names.includes(type)) {
    const rel = resolveRelation(name, type, parent, ids, displayFields);
    return {
      type: "relation",
      name,
      title,
      required,
      ...rel,
      isCurrentUser: false,
      isCurrentTeam: false,
    };
  }
  if (namesSingular.includes(type)) {
    const plural = pluralize.plural(type);
    if (names.includes(plural)) {
      const rel = resolveRelation(name, plural, parent, ids, displayFields);
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
        isCurrentTeam: false,
      };
    }
  }

  // Validate that it's a known simple type
  if (!SIMPLE_TYPES.includes(type)) {
    const allValidTypes = [
      ...new Set([
        ...FIELD_TYPES.map((entry) =>
          entry.type === "relation" ? "references" : entry.type,
        ),
        ...(options.features.auth ? ["current_user"] : []),
        ...(options.features.teams ? ["current_team"] : []),
        ...names,
      ]),
    ];
    throw new InvalidArgumentError(
      `Invalid field type: ${type}. Valid types are: ${allValidTypes.join(", ")}`,
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
    const { name, type: rawType, modifiers } = splitFieldParts(fieldDef);

    if (!name || !rawType) {
      throw new InvalidArgumentError(
        `Invalid field format: ${fieldDef}. Expected format: name:type, name:type! or name:type:unique`,
      );
    }

    if (!FIELD_NAME_PATTERN.test(name)) {
      throw new InvalidArgumentError(
        `Invalid field name: ${name}. ${FIELD_NAME_RULE}`,
      );
    }

    const normalized = normalizeType(rawType);
    parsed.push(
      applyModifiers(
        resolveField(name, normalized, parent, collections, options),
        modifiers,
        fieldDef,
      ),
    );
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
  options: Pick<Options, "env" | "features" | "getCollections">,
): Promise<{ fields: Field[]; auth: OwnershipResult | undefined }> {
  let collections: Collection[];
  if (options.env === "runtime") {
    if (!options.getCollections) {
      throw new Error(
        'A `getCollections` provider is required when env is "runtime". ' +
          "It is supplied by the vela CLI; upgrade to vela >= 0.10.0.",
      );
    }
    collections = await options.getCollections();
  } else {
    const { getPreviewCollections } = await import("./env.preview");
    collections = getPreviewCollections(options);
  }
  return resolveFields(fields, parent, collections, options);
}
