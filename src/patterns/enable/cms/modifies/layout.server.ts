import fs from "node:fs";
import dedent from "dedent";
import {
  Node,
  Project,
  QuoteKind,
  SyntaxKind,
  type ArrowFunction,
  type Block,
  type FunctionDeclaration,
  type FunctionExpression,
  type ObjectLiteralExpression,
  type ReturnStatement,
  type SourceFile,
} from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import type { ImportSpec } from "../../../../runtime/ts-morph-helpers";

type LoadFunction = ArrowFunction | FunctionExpression | FunctionDeclaration;

export interface LayoutServerLocale {
  /**
   * Expression passed as `locale` to `loadCms`, given the name of the load's
   * event parameter: `() => "'en'"` or `(event) => \`getLocale(${event}.url)\``.
   */
  expression: (eventName: string) => string;
  /** Imports the expression depends on. */
  imports?: ImportSpec[];
}

/** A single-locale site: the literal default locale. */
export const DEFAULT_LOCALE: LayoutServerLocale = {
  expression: () => "'en'",
};

/** A wuchale site: the locale enable-i18n's reroute already resolved from the URL. */
export const WUCHALE_LOCALE: LayoutServerLocale = {
  expression: (eventName) => `getLocale(${eventName}.url)`,
  imports: [
    { namedImports: ["getLocale"], moduleSpecifier: "$locales/main.url" },
  ],
};

function cmsSnippet(eventName: string, locale: string): string {
  return dedent`
    const { cms, notFound, gone, redirectTo } = await loadCms(${eventName}, { locale: ${locale} });
    if (redirectTo) redirect(308, redirectTo);
    if (gone) error(410, 'Gone');
    if (notFound) error(404, 'Not found');
  `;
}

const LOAD_SNIPPET = dedent`
  import { error, redirect } from '@sveltejs/kit';
  import { loadCms } from '$lib/cms';

  export const load = async (event) => {
    ${cmsSnippet("event", "'en'").split("\n").join("\n    ")}

    return { cms };
  };
`;

const FAILURE_HINT = [
  "Call loadCms from the root +layout.server.ts load and return `cms`:",
  "",
  LOAD_SNIPPET,
  "",
  "loadCms needs the whole event, so a destructured parameter has to become",
  "`event` with the destructuring moved into the body.",
].join("\n");

const NOT_FOUND_HINT = [
  "Create src/routes/+layout.server.ts with a load that calls loadCms:",
  "",
  LOAD_SNIPPET,
].join("\n");

function ensureNamedImports(
  sourceFile: SourceFile,
  moduleSpecifier: string,
  names: string[],
) {
  const existing = sourceFile
    .getImportDeclarations()
    .find((d) => d.getModuleSpecifierValue() === moduleSpecifier);
  if (!existing) {
    sourceFile.addImportDeclaration({ namedImports: names, moduleSpecifier });
    return;
  }
  for (const name of names) {
    const has = existing.getNamedImports().some((ni) => ni.getName() === name);
    if (!has) existing.addNamedImport(name);
  }
}

function ensureImportSpec(sourceFile: SourceFile, spec: ImportSpec) {
  if (spec.namedImports?.length) {
    ensureNamedImports(sourceFile, spec.moduleSpecifier, spec.namedImports);
  }
  const existing = sourceFile
    .getImportDeclarations()
    .find((d) => d.getModuleSpecifierValue() === spec.moduleSpecifier);
  if (existing) return;
  sourceFile.addImportDeclaration({
    moduleSpecifier: spec.moduleSpecifier,
    defaultImport: spec.defaultImport,
    namespaceImport: spec.namespaceImport,
  });
}

/** Peel wrappers (`loadFlash(fn)`, `(fn)`, `fn satisfies X`) down to the function. */
function unwrapFunction(node: Node): ArrowFunction | FunctionExpression | null {
  if (Node.isArrowFunction(node) || Node.isFunctionExpression(node)) {
    return node;
  }
  if (
    Node.isParenthesizedExpression(node) ||
    Node.isAsExpression(node) ||
    Node.isSatisfiesExpression(node)
  ) {
    return unwrapFunction(node.getExpression());
  }
  if (Node.isCallExpression(node)) {
    for (const arg of node.getArguments()) {
      const fn = unwrapFunction(arg);
      if (fn) return fn;
    }
  }
  return null;
}

/** The exported `load`, whether declared as a function or wrapped in a const. */
function findLoadFunction(sourceFile: SourceFile): LoadFunction | null {
  const declaration = sourceFile.getFunction("load");
  if (declaration) {
    return declaration.isExported() ? declaration : null;
  }

  const variable = sourceFile.getVariableDeclaration("load");
  if (!variable) return null;
  if (!variable.getVariableStatement()?.isExported()) return null;

  const initializer = variable.getInitializer();
  return initializer ? unwrapFunction(initializer) : null;
}

function isFunctionNode(node: Node): boolean {
  return (
    Node.isArrowFunction(node) ||
    Node.isFunctionExpression(node) ||
    Node.isFunctionDeclaration(node) ||
    Node.isMethodDeclaration(node)
  );
}

/** The single, final `return { ... }` of the load body, or null for any other shape. */
function findReturnedObject(
  fn: LoadFunction,
  body: Block,
): { statement: ReturnStatement; object: ObjectLiteralExpression } | null {
  const statements = body.getStatements();
  const last = statements[statements.length - 1];
  if (!last || !Node.isReturnStatement(last)) return null;

  // Early returns would need the cms block hoisted above them; refuse rather
  // than guess where it belongs.
  const returns = body
    .getDescendantsOfKind(SyntaxKind.ReturnStatement)
    .filter((r) => r.getFirstAncestor(isFunctionNode) === fn);
  if (returns.length !== 1) return null;

  let expression = last.getExpression();
  while (expression && Node.isParenthesizedExpression(expression)) {
    expression = expression.getExpression();
  }
  if (!expression || !Node.isObjectLiteralExpression(expression)) return null;

  return { statement: last, object: expression };
}

function hasProperty(object: ObjectLiteralExpression, name: string): boolean {
  return object.getProperties().some((property) => {
    if (
      Node.isPropertyAssignment(property) ||
      Node.isShorthandPropertyAssignment(property)
    ) {
      return property.getName() === name;
    }
    return false;
  });
}

/**
 * Wires `loadCms` into the root `+layout.server.ts`:
 *
 * - `loadCms` needs the whole request event, so a destructured parameter is
 *   renamed to `event` and the destructuring becomes the first statement.
 * - The tombstone triple (`redirectTo`, `gone`, `notFound`) is handled just
 *   before the return.
 * - `cms` is added to the returned object, ahead of any spread so nothing
 *   later can shadow it.
 *
 * Anything else — no exported `load`, an expression-bodied arrow, several
 * returns, a non-literal return — is reported as `failed` with the snippet to
 * paste, and the file is left exactly as it was.
 */
export function modifyLayoutServer(
  layoutServerPath: string,
  locale: LayoutServerLocale = DEFAULT_LOCALE,
): ModifyOutcome {
  if (!fs.existsSync(layoutServerPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const original = fs.readFileSync(layoutServerPath, "utf8");
  if (original.includes("loadCms(")) {
    return { status: "success", changed: false };
  }

  const project = new Project({
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.addSourceFileAtPath(layoutServerPath);

  // --- Inspect everything before touching anything. ---
  const fn = findLoadFunction(sourceFile);
  if (!fn) return { status: "failed", message: FAILURE_HINT };

  const body = fn.getBody();
  if (!body || !Node.isBlock(body)) {
    return { status: "failed", message: FAILURE_HINT };
  }

  const params = fn.getParameters();
  if (params.length > 1) return { status: "failed", message: FAILURE_HINT };

  const param = params[0];
  let eventName = "event";
  let destructuring: string | null = null;
  if (param) {
    if (param.getInitializer() || param.isRestParameter()) {
      return { status: "failed", message: FAILURE_HINT };
    }
    const nameNode = param.getNameNode();
    if (Node.isIdentifier(nameNode)) {
      eventName = nameNode.getText();
    } else if (Node.isObjectBindingPattern(nameNode)) {
      destructuring = nameNode.getText();
    } else {
      return { status: "failed", message: FAILURE_HINT };
    }
  }

  const returned = findReturnedObject(fn, body);
  if (!returned) return { status: "failed", message: FAILURE_HINT };

  // --- Mutate bottom-up so earlier node references stay valid. ---
  if (!hasProperty(returned.object, "cms")) {
    const spreadIndex = returned.object
      .getProperties()
      .findIndex((property) => Node.isSpreadAssignment(property));
    if (spreadIndex === -1) {
      returned.object.addShorthandPropertyAssignment({ name: "cms" });
    } else {
      returned.object.insertShorthandPropertyAssignment(spreadIndex, {
        name: "cms",
      });
    }
  }

  const returnIndex = body.getStatements().indexOf(returned.statement);
  body.insertStatements(
    returnIndex,
    `\n${cmsSnippet(eventName, locale.expression(eventName))}\n`,
  );

  if (destructuring && param) {
    body.insertStatements(0, `const ${destructuring} = ${eventName};`);
    const typeText = param.getTypeNode()?.getText();
    param.replaceWithText(typeText ? `${eventName}: ${typeText}` : eventName);
  } else if (!param) {
    fn.addParameter({ name: eventName });
  }

  if (!fn.isAsync()) fn.setIsAsync(true);

  ensureNamedImports(sourceFile, "@sveltejs/kit", ["error", "redirect"]);
  ensureNamedImports(sourceFile, "$lib/cms", ["loadCms"]);
  for (const spec of locale.imports ?? []) {
    ensureImportSpec(sourceFile, spec);
  }

  sourceFile.formatText();
  sourceFile.saveSync();
  return { status: "success", changed: true };
}
