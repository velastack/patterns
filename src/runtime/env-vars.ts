import fs from "node:fs";
import path from "node:path";
import {
  Node,
  Project,
  QuoteKind,
  SyntaxKind,
  type Expression,
  type ObjectLiteralElementLike,
  type ObjectLiteralExpression,
  type SourceFile,
  type Statement,
} from "ts-morph";
import type { File, ModifyOutcome } from "../core/types";
import { languageFromPath } from "../core/util";
import { toDeleteEntry } from "../patterns/destroy/shared";
import { modifyOutcomeToFile } from "./modify-file";
import {
  ENV_DECL_CANDIDATES,
  envVarEntry,
  envVarsFile,
  ENV_MODULE,
  type EnvVarSpec,
} from "./env-vars-file";
import { ensureNamedImport, formatLikeSource } from "./ts-morph-helpers";

export { ENV_DECL_CANDIDATES, envVarEntry, envVarsFile, type EnvVarSpec };

/**
 * Declares environment variables in `src/env.ts`, where SvelteKit 3 reads
 * them: a variable it finds no declaration for is not exposed through
 * `$app/env/private` or `$app/env/public` at all.
 *
 * Three shapes of `variables` are edited:
 *
 * - `export const variables = defineEnvVars({ ... })`
 * - `const variables = defineEnvVars({ ... }); export { variables }`
 * - either of the above with a plain object literal in place of the call
 *
 * Entries are matched by property name, quoted or not, and an entry that is
 * already there is never touched: a project that declared `STRIPE_SECRET_KEY`
 * as required keeps it required.
 */

const VARIABLES = "variables";
const DEFINE = "defineEnvVars";

export type EnvVarsUnsupported =
  /** `variables` is exported some other way: a function, `export let variables;`, a re-export. */
  | "not-variable"
  /** `variables` is not an object literal or `defineEnvVars({ ... })`. */
  | "not-object"
  /** The object spreads another one in, which may already declare the names. */
  | "spread"
  /** A computed key (`[name]: ...`) whose name can't be read. */
  | "computed-key";

export type EnvVarsEditResult =
  | { status: "changed" | "unchanged" }
  | { status: "unsupported"; reason: EnvVarsUnsupported };

type Located =
  | { kind: "object"; object: ObjectLiteralExpression }
  | { kind: "missing" }
  | { kind: "unsupported"; reason: EnvVarsUnsupported };

function unwrap(expr: Expression): Expression {
  let current = expr;
  for (;;) {
    if (
      Node.isParenthesizedExpression(current) ||
      Node.isAsExpression(current) ||
      Node.isSatisfiesExpression(current)
    ) {
      current = current.getExpression();
      continue;
    }
    return current;
  }
}

/** The local name exported as `variables`: itself, or `x` in `export { x as variables }`. */
function exportedLocalName(sf: SourceFile): string | null | "re-export" {
  for (const decl of sf.getExportDeclarations()) {
    for (const spec of decl.getNamedExports()) {
      const exported = spec.getAliasNode()?.getText() ?? spec.getName();
      if (exported !== VARIABLES) continue;
      if (decl.getModuleSpecifier()) return "re-export";
      return spec.getName();
    }
  }
  return null;
}

/** A top-level import or destructuring pattern that binds `name`. */
function bindsName(sf: SourceFile, name: string): boolean {
  const imported = sf
    .getImportDeclarations()
    .some(
      (decl) =>
        decl.getDefaultImport()?.getText() === name ||
        decl.getNamespaceImport()?.getText() === name ||
        decl
          .getNamedImports()
          .some(
            (ni) => (ni.getAliasNode()?.getText() ?? ni.getName()) === name,
          ),
    );
  if (imported) return true;
  return sf.getVariableStatements().some((statement) =>
    statement.getDeclarations().some((decl) => {
      const nameNode = decl.getNameNode();
      return (
        !Node.isIdentifier(nameNode) &&
        nameNode
          .getDescendantsOfKind(SyntaxKind.Identifier)
          .some(
            (id) =>
              id.getText() === name &&
              (Node.isBindingElement(id.getParent()) ||
                Node.isShorthandPropertyAssignment(id.getParent())),
          )
      );
    }),
  );
}

function locateVariables(sf: SourceFile): Located {
  const reExported = exportedLocalName(sf);
  if (reExported === "re-export") {
    return { kind: "unsupported", reason: "not-variable" };
  }
  const local = reExported ?? VARIABLES;

  const decl = sf.getVariableDeclaration(local);
  if (!decl) {
    // A function, class, import or destructured binding of that name,
    // exported or not, is not ours to replace.
    const taken =
      sf.getFunction(local) ?? sf.getClass(local) ?? sf.getEnum(local);
    if (taken || reExported || bindsName(sf, local)) {
      return { kind: "unsupported", reason: "not-variable" };
    }
    return { kind: "missing" };
  }
  if (!reExported && !decl.isExported()) {
    // `const variables = ...` that SvelteKit can't see; exporting it is the
    // developer's call, not ours.
    return { kind: "unsupported", reason: "not-variable" };
  }
  if (!Node.isIdentifier(decl.getNameNode())) {
    return { kind: "unsupported", reason: "not-variable" };
  }
  const init = decl.getInitializer();
  if (!init) return { kind: "unsupported", reason: "not-variable" };

  const value = unwrap(init);
  if (Node.isObjectLiteralExpression(value)) {
    return { kind: "object", object: value };
  }
  if (
    Node.isCallExpression(value) &&
    value.getExpression().getText() === DEFINE
  ) {
    const arg = value.getArguments()[0];
    const object = arg && unwrap(arg as Expression);
    if (object && Node.isObjectLiteralExpression(object)) {
      return { kind: "object", object };
    }
  }
  return { kind: "unsupported", reason: "not-object" };
}

/** A property's name as SvelteKit sees it, `null` for a spread or computed key. */
function propertyName(prop: ObjectLiteralElementLike): string | null {
  if (Node.isSpreadAssignment(prop)) return null;
  const nameNode = prop.getNameNode();
  if (Node.isComputedPropertyName(nameNode)) {
    const inner = nameNode.getExpression();
    return Node.isStringLiteral(inner) ||
      Node.isNoSubstitutionTemplateLiteral(inner)
      ? inner.getLiteralText()
      : null;
  }
  if (
    Node.isStringLiteral(nameNode) ||
    Node.isNoSubstitutionTemplateLiteral(nameNode)
  ) {
    return nameNode.getLiteralText();
  }
  return nameNode.getText();
}

function declaredNames(
  object: ObjectLiteralExpression,
): Set<string> | EnvVarsUnsupported {
  const names = new Set<string>();
  for (const prop of object.getProperties()) {
    if (Node.isSpreadAssignment(prop)) return "spread";
    const name = propertyName(prop);
    if (name === null) return "computed-key";
    names.add(name);
  }
  return names;
}

/** The quote the file already writes its strings with. */
function quoteOf(sf: SourceFile): "'" | '"' {
  const first = sf.getFirstDescendantByKind(SyntaxKind.StringLiteral);
  return first?.getText().startsWith('"') ? '"' : "'";
}

/**
 * Add a declaration for every spec `sf` doesn't declare yet. Creates
 * `export const variables = defineEnvVars({ ... })`, and its import, when the
 * file has no `variables` at all. Neither formats nor saves.
 */
export function addEnvVars(
  sf: SourceFile,
  specs: EnvVarSpec[],
): EnvVarsEditResult {
  const located = locateVariables(sf);
  if (located.kind === "unsupported") {
    return { status: "unsupported", reason: located.reason };
  }
  const quote = quoteOf(sf);

  if (located.kind === "missing") {
    const unique = dedupe(specs);
    if (unique.length === 0) return { status: "unchanged" };
    ensureNamedImport(sf, ENV_MODULE, DEFINE);
    const entries = unique
      .map((spec) => `\t${envVarEntry(spec, { quote })}`)
      .join(",\n");
    sf.addStatements(
      `\nexport const ${VARIABLES} = ${DEFINE}({\n${entries}\n});`,
    );
    return { status: "changed" };
  }

  const declared = declaredNames(located.object);
  if (typeof declared === "string") {
    return { status: "unsupported", reason: declared };
  }
  const missing = dedupe(specs).filter((spec) => !declared.has(spec.name));
  if (missing.length === 0) return { status: "unchanged" };
  for (const spec of missing) {
    located.object.addProperty(envVarEntry(spec, { quote }));
  }
  return { status: "changed" };
}

/**
 * Remove the declarations of `names` from `sf`. A file with no `variables`,
 * or none of the names, is unchanged. Neither formats nor saves.
 */
export function removeEnvVars(
  sf: SourceFile,
  names: string[],
): EnvVarsEditResult {
  const located = locateVariables(sf);
  if (located.kind === "missing") return { status: "unchanged" };
  if (located.kind === "unsupported") {
    return { status: "unsupported", reason: located.reason };
  }
  const wanted = new Set(names);
  const doomed = located.object.getProperties().filter((prop) => {
    const name = propertyName(prop);
    return name !== null && wanted.has(name);
  });
  if (doomed.length === 0) return { status: "unchanged" };
  for (const prop of doomed.reverse()) prop.remove();
  if (located.object.getProperties().length === 0) {
    located.object.replaceWithText("{}");
  }
  return { status: "changed" };
}

function dedupe(specs: EnvVarSpec[]): EnvVarSpec[] {
  const seen = new Set<string>();
  return specs.filter((spec) => {
    if (seen.has(spec.name)) return false;
    seen.add(spec.name);
    return true;
  });
}

function newProject(): Project {
  return new Project({
    compilerOptions: { allowJs: true },
    skipFileDependencyResolution: true,
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
}

/** The project's declaration file: `src/env.ts` or `src/env.js`, if either exists. */
export function findEnvDecl(root: string): string | null {
  for (const rel of ENV_DECL_CANDIDATES) {
    const abs = path.join(root, rel);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

function relative(root: string, filePath: string): string {
  return path.relative(root, filePath).split(path.sep).join("/");
}

const REASONS: Record<EnvVarsUnsupported, string> = {
  "not-variable": "its `variables` export is not a variable this can edit",
  "not-object":
    "`variables` is not an object literal or a `defineEnvVars({ ... })` call",
  spread: "`variables` spreads in another object",
  "computed-key": "`variables` has a computed key",
};

function addHint(
  file: string,
  reason: EnvVarsUnsupported,
  specs: EnvVarSpec[],
): string {
  return [
    `Could not edit ${file}: ${REASONS[reason]}.`,
    "Declare these in the object passed to defineEnvVars() (or exported as `variables`), skipping any already there:",
    "",
    ...dedupe(specs).map((spec) => `${envVarEntry(spec)},`),
  ].join("\n");
}

function removeHint(
  file: string,
  reason: EnvVarsUnsupported,
  names: string[],
): string {
  return [
    `Could not edit ${file}: ${REASONS[reason]}.`,
    `Remove these declarations from \`variables\` by hand: ${names.join(", ")}`,
  ].join("\n");
}

export interface ModifyEnvVarsResult {
  /** `src/env.ts` to create, when the project has no declaration file. */
  create?: File;
  /** The existing declaration file, already saved when `outcome` changed it. */
  modify?: { filePath: string; outcome: ModifyOutcome };
}

/**
 * Declare `specs` in the project's `src/env.ts` (or `src/env.js`). Existing
 * entries are never touched.
 *
 * - No declaration file: `create` holds a new `src/env.ts` (always `.ts`,
 *   written like the CLI templates' one); nothing is written yet.
 * - An existing file is edited and saved in place, and `modify` reports it
 *   like every other runtime modifier: turn it into a File with
 *   `modifyOutcomeToFile` (or use {@link modifyEnvVarsFiles}).
 * - A file whose `variables` can't be edited safely is left alone, and the
 *   `failed` outcome's message lists the exact entries to paste.
 */
export function modifyEnvVars(
  root: string,
  specs: EnvVarSpec[],
): ModifyEnvVarsResult {
  const existing = findEnvDecl(root);
  if (!existing) {
    if (dedupe(specs).length === 0) return {};
    const filePath = path.join(root, ENV_DECL_CANDIDATES[0]);
    return {
      create: {
        path: filePath,
        language: languageFromPath(filePath),
        content: envVarsFile(specs),
        status: "success",
      },
    };
  }

  const sf = newProject().addSourceFileAtPath(existing);
  const original = sf.getFullText();
  const result = addEnvVars(sf, specs);
  if (result.status === "unsupported") {
    return {
      modify: {
        filePath: existing,
        outcome: {
          status: "failed",
          message: addHint(relative(root, existing), result.reason, specs),
        },
      },
    };
  }
  if (result.status === "unchanged") {
    return {
      modify: {
        filePath: existing,
        outcome: { status: "success", changed: false },
      },
    };
  }
  formatLikeSource(sf);
  const changed = sf.getFullText() !== original;
  if (changed) sf.saveSync();
  return {
    modify: { filePath: existing, outcome: { status: "success", changed } },
  };
}

/** {@link modifyEnvVars} as the File entries a pattern's Result carries. */
export function modifyEnvVarsFiles(
  root: string,
  specs: EnvVarSpec[],
): { create: File | null; modify: File | null } {
  const { create, modify } = modifyEnvVars(root, specs);
  return {
    create: create ?? null,
    modify: modify
      ? modifyOutcomeToFile(modify.filePath, modify.outcome)
      : null,
  };
}

export interface UnmodifyEnvVarsResult {
  filePath: string;
  outcome: ModifyOutcome;
  /**
   * The revert left nothing but the `defineEnvVars` import and an empty
   * `variables`. The emptied file has been saved; the caller reports it as a
   * delete (`toDeleteEntry(filePath)`) instead of a modify, as
   * {@link unmodifyEnvVarsFiles} does.
   */
  deleted: boolean;
}

/**
 * Remove the declarations of `names` from `src/env.ts` (or `.js`). A project
 * without the file, or without the names, is a no-op success.
 */
export function unmodifyEnvVars(
  root: string,
  names: string[],
): UnmodifyEnvVarsResult {
  const existing = findEnvDecl(root);
  if (!existing) {
    return {
      filePath: path.join(root, ENV_DECL_CANDIDATES[0]),
      outcome: { status: "success", changed: false },
      deleted: false,
    };
  }

  const sf = newProject().addSourceFileAtPath(existing);
  const original = sf.getFullText();
  const result = removeEnvVars(sf, names);
  if (result.status === "unsupported") {
    return {
      filePath: existing,
      outcome: {
        status: "failed",
        message: removeHint(relative(root, existing), result.reason, names),
      },
      deleted: false,
    };
  }
  if (result.status === "unchanged") {
    return {
      filePath: existing,
      outcome: { status: "success", changed: false },
      deleted: false,
    };
  }
  formatLikeSource(sf);
  const changed = sf.getFullText() !== original;
  if (changed) sf.saveSync();
  return {
    filePath: existing,
    outcome: { status: "success", changed },
    deleted: changed && holdsNothing(sf),
  };
}

/** {@link unmodifyEnvVars} as the File entries a pattern's Result carries. */
export function unmodifyEnvVarsFiles(
  root: string,
  names: string[],
): { modify: File | null; delete: File | null } {
  const { filePath, outcome, deleted } = unmodifyEnvVars(root, names);
  if (deleted) return { modify: null, delete: toDeleteEntry(filePath) };
  return { modify: modifyOutcomeToFile(filePath, outcome), delete: null };
}

/**
 * Only the `defineEnvVars` import, an empty `variables` and its
 * `export { variables }` are left. Comments don't count.
 */
function holdsNothing(sf: SourceFile): boolean {
  const located = locateVariables(sf);
  if (located.kind !== "object") return false;
  if (located.object.getProperties().length > 0) return false;
  const decl = located.object.getFirstAncestorByKind(
    SyntaxKind.VariableStatement,
  );
  return sf.getStatements().every((statement: Statement) => {
    if (statement === decl) return true;
    if (Node.isEmptyStatement(statement)) return true;
    if (Node.isImportDeclaration(statement)) {
      return (
        statement.getModuleSpecifierValue() === ENV_MODULE &&
        !statement.getDefaultImport() &&
        !statement.getNamespaceImport() &&
        statement.getNamedImports().every((ni) => ni.getName() === DEFINE)
      );
    }
    if (Node.isExportDeclaration(statement)) {
      return (
        !statement.getModuleSpecifier() &&
        statement
          .getNamedExports()
          .every(
            (spec) =>
              (spec.getAliasNode()?.getText() ?? spec.getName()) === VARIABLES,
          )
      );
    }
    return false;
  });
}
