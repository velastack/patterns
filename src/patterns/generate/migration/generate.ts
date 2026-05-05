import pluralize from "pluralize";
import type { FieldChange, Options, Result } from "../../../core/types";
import { InvalidArgumentError } from "../../../core/errors";
import { loadCollections, toCollectionFieldSpec } from "../../../core/shared";
import { parseModel, resolveFields, validateModelName } from "../../../parse";

type Op = "add" | "remove" | "rename" | "references";
const VALID_OPS: ReadonlySet<Op> = new Set<Op>([
  "add",
  "remove",
  "rename",
  "references",
]);

function parsePatternArgs(argv: string[]): {
  collectionName: string;
  op: Op;
  rest: string[];
} {
  const [collectionName, op, ...rest] = argv;
  if (!collectionName || !op) {
    throw new InvalidArgumentError(
      "Invalid command arguments. Expected: <collection> <add|remove|rename|references> <args...>",
    );
  }
  if (!VALID_OPS.has(op as Op)) {
    throw new InvalidArgumentError(
      `Invalid op: "${op}". Expected one of: add, remove, rename, references`,
    );
  }
  return { collectionName, op: op as Op, rest };
}

export async function generate(options: Options): Promise<Result> {
  const { collectionName, op, rest } = parsePatternArgs(options.argv);
  validateModelName(collectionName);

  const collections = await loadCollections(options);
  const collection = collections.find((c) => c.name === collectionName);
  if (!collection) {
    throw new InvalidArgumentError(`Collection "${collectionName}" not found`);
  }

  const parent = parseModel(collectionName, options);
  const existingNames = new Set(collection.fields.map((f) => f.name));
  const changes: FieldChange[] = [];

  if (op === "add" || op === "references") {
    const fieldDefs =
      op === "references"
        ? [referencesFieldDef(rest)]
        : requireNonEmpty(
            rest,
            "Expected at least one field definition for add",
          );

    const { fields } = resolveFields(fieldDefs, parent, collections, options);
    for (const field of fields) {
      if (existingNames.has(field.name)) {
        throw new InvalidArgumentError(
          `Field "${field.name}" already exists on collection "${collectionName}"`,
        );
      }
      changes.push({ op: "add", field: toCollectionFieldSpec(field) });
    }
  } else if (op === "remove") {
    const fieldNames = requireNonEmpty(
      rest,
      "Expected at least one field name for remove",
    );
    for (const fieldName of fieldNames) {
      if (!existingNames.has(fieldName)) {
        throw new InvalidArgumentError(
          `Field "${fieldName}" does not exist on collection "${collectionName}"`,
        );
      }
      changes.push({ op: "remove", fieldName });
    }
  } else {
    if (rest.length !== 2) {
      throw new InvalidArgumentError(
        `Expected exactly two arguments for rename (old and new), got ${rest.length}`,
      );
    }
    const [from, to] = rest;
    if (!existingNames.has(from)) {
      throw new InvalidArgumentError(
        `Field "${from}" does not exist on collection "${collectionName}"`,
      );
    }
    if (existingNames.has(to)) {
      throw new InvalidArgumentError(
        `Field "${to}" already exists on collection "${collectionName}"`,
      );
    }
    changes.push({ op: "rename", from, to });
  }

  return {
    creates: [],
    modifies: [],
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [{ collectionName, changes }],
    collectionDrops: [],
  } satisfies Result;
}

function referencesFieldDef(rest: string[]): string {
  if (rest.length !== 1) {
    throw new InvalidArgumentError(
      `Expected exactly one argument for references, got ${rest.length}`,
    );
  }
  const ref = rest[0];
  const target = pluralize.plural(pluralize.singular(ref));
  return `${ref}:${target}`;
}

function requireNonEmpty(rest: string[], message: string): string[] {
  if (rest.length === 0) {
    throw new InvalidArgumentError(message);
  }
  return rest;
}
