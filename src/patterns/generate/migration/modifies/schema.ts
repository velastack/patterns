import fs from "node:fs";
import path from "node:path";
import {
  Node,
  Project,
  SyntaxKind,
  type ObjectLiteralExpression,
  type PropertyAssignment,
  type ShorthandPropertyAssignment,
  type SourceFile,
} from "ts-morph";
import { schemaEntriesForFields } from "../../../../core/shared";
import type { File, ModifyOutcome } from "../../../../core/types";
import { modifyOutcomeToFile } from "../../../../runtime/modify-file";
import { formatLikeSource } from "../../../../runtime/ts-morph-helpers";
import type { ResolvedMigration } from "../generate";

/** One key of a zod object: its name and the schema it is given. */
export interface SchemaEntry {
  name: string;
  schema: string;
}

/**
 * What a migration did to a collection, as it applies to the zod schema that
 * describes it. An `add` carries every key its field needs (a multi-file
 * field has three); `remove` and `rename` name the field, and take its
 * `name+` / `name-` keys along.
 */
export type SchemaChange =
  | { op: "add"; entries: SchemaEntry[] }
  | { op: "remove"; fieldName: string }
  | { op: "rename"; from: string; to: string };

/** The keys a field may have in a schema: its own, and a multi-file field's two. */
const KEY_SUFFIXES = ["", "+", "-"];

function propertyKey(name: string): string {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name) ? name : `'${name}'`;
}

function unquote(name: string): string {
  return name.replace(/^(["'`])(.*)\1$/, "$2");
}

/**
 * The object literal of `export const <name> = z.object({ ... })`, through a
 * trailing `satisfies` / `as` and any methods chained on (`.strict()`,
 * `.refine(...)`).
 */
function findZodObject(
  sourceFile: SourceFile,
  schemaName: string,
): ObjectLiteralExpression | undefined {
  const declarations = sourceFile.getVariableDeclarations();
  const candidates = [
    ...declarations.filter((d) => d.getName() === schemaName),
    ...declarations.filter((d) => d.getName() !== schemaName),
  ];

  const found: ObjectLiteralExpression[] = [];
  for (const declaration of candidates) {
    let node: Node | undefined = declaration.getInitializer();
    while (node) {
      if (
        Node.isSatisfiesExpression(node) ||
        Node.isAsExpression(node) ||
        Node.isParenthesizedExpression(node)
      ) {
        node = node.getExpression();
        continue;
      }
      if (!Node.isCallExpression(node)) break;
      const callee = node.getExpression();
      if (
        Node.isPropertyAccessExpression(callee) &&
        callee.getName() === "object" &&
        callee.getExpression().getText() === "z"
      ) {
        const [shape] = node.getArguments();
        if (shape && Node.isObjectLiteralExpression(shape)) found.push(shape);
        break;
      }
      // `<something>.method(...)`: look at what the method was called on.
      node = Node.isPropertyAccessExpression(callee)
        ? callee.getExpression()
        : undefined;
    }
    // The schema under its generated name wins; otherwise the file has to
    // hold exactly one, or there is no telling which the collection's is.
    if (declaration.getName() === schemaName && found.length === 1) {
      return found[0];
    }
  }
  return found.length === 1 ? found[0] : undefined;
}

function findProperty(
  shape: ObjectLiteralExpression,
  name: string,
): PropertyAssignment | ShorthandPropertyAssignment | undefined {
  return shape
    .getProperties()
    .filter(
      (property) =>
        Node.isPropertyAssignment(property) ||
        Node.isShorthandPropertyAssignment(property),
    )
    .find((property) => unquote(property.getName()) === name);
}

/** What the user would write to make the change by hand. */
function describeChange(change: SchemaChange): string {
  if (change.op === "add") {
    return change.entries
      .map((entry) => `add \`${propertyKey(entry.name)}: ${entry.schema}\``)
      .join(", ");
  }
  if (change.op === "remove") return `remove \`${change.fieldName}\``;
  return `rename \`${change.from}\` to \`${change.to}\``;
}

function applyChange(
  shape: ObjectLiteralExpression,
  change: SchemaChange,
): boolean {
  let changed = false;

  if (change.op === "add") {
    for (const entry of change.entries) {
      // Already there: added by hand, most likely. Theirs stands.
      if (findProperty(shape, entry.name)) continue;
      shape.addPropertyAssignment({
        name: propertyKey(entry.name),
        initializer: entry.schema,
      });
      changed = true;
    }
    return changed;
  }

  for (const suffix of KEY_SUFFIXES) {
    const name =
      (change.op === "remove" ? change.fieldName : change.from) + suffix;
    const property = findProperty(shape, name);
    if (!property) continue;

    if (change.op === "remove") {
      property.remove();
      changed = true;
      continue;
    }

    const to = change.to + suffix;
    if (findProperty(shape, to)) continue;
    if (Node.isPropertyAssignment(property)) {
      property.getNameNode().replaceWithText(propertyKey(to));
    } else {
      // `{ title }` → `{ heading: title }`: the value keeps its name.
      property.replaceWithText(`${propertyKey(to)}: ${property.getName()}`);
    }
    changed = true;
  }
  return changed;
}

/**
 * Brings the zod schema of a collection in line with a migration just applied
 * to it: `generate resource` and the scaffolds write the schema once, and a
 * field added later is optional, so nothing else notices it is missing.
 *
 * Only the keys the migration names are touched. A file without a
 * recognisable `z.object({ ... })` is left as it is and reported, with the
 * edit to make by hand.
 */
export function modifySchema(
  schemaPath: string,
  schemaName: string,
  changes: SchemaChange[],
): ModifyOutcome {
  if (!fs.existsSync(schemaPath) || changes.length === 0) {
    return { status: "success", changed: false };
  }

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });
  const sourceFile = project.addSourceFileAtPath(schemaPath);
  const shape = findZodObject(sourceFile, schemaName);

  if (!shape) {
    return {
      status: "failed",
      message: `The collection changed, but no \`z.object({ ... })\` schema was found in this file to change with it. Update it by hand: ${changes.map(describeChange).join("; ")}.`,
    };
  }

  let changed = false;
  for (const change of changes) {
    changed = applyChange(shape, change) || changed;
  }
  if (!changed) {
    return { status: "success", changed: false };
  }

  formatLikeSource(sourceFile);
  sourceFile.saveSync();
  return { status: "success", changed: true };
}

/**
 * Whether a remote form validates with the model's schema. Its json fields
 * are then typed as the text a textarea posts, not `z.any()`; see
 * `generateSchemaSnippet`.
 */
function backsRemoteForm(root: string, modelName: string): boolean {
  const routes = path.join(root, "src", "routes");
  if (!fs.existsSync(routes)) return false;
  const imported = new RegExp(`lib/schemas/${modelName}(\\.js|\\.ts)?["']`);
  return fs
    .readdirSync(routes, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".remote.ts"))
    .some((file) =>
      imported.test(fs.readFileSync(path.join(routes, file), "utf8")),
    );
}

/**
 * `modifySchema` for a migration the generator just applied, on the schema
 * file `generate resource` and the scaffolds write for its collection. `null`
 * when there is nothing to report: no such file, or nothing to change in it.
 */
export function modifySchemaForMigration(
  root: string,
  { model, added, changes }: ResolvedMigration,
): File | null {
  const schemaPath = path.join(
    root,
    "src",
    "lib",
    "schemas",
    `${model.name}.ts`,
  );
  if (!fs.existsSync(schemaPath)) return null;

  const schemaChanges: SchemaChange[] = [];
  if (added.length > 0) {
    schemaChanges.push({
      op: "add",
      entries: schemaEntriesForFields(added, {
        forForm: true,
        remote: backsRemoteForm(root, model.name),
      }),
    });
  }
  for (const change of changes) {
    if (change.op !== "add") schemaChanges.push(change);
  }

  return modifyOutcomeToFile(
    schemaPath,
    modifySchema(schemaPath, model.schemaName, schemaChanges),
  );
}
