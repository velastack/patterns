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
  type ParameterDeclaration,
  type ReturnStatement,
  type SourceFile,
} from "ts-morph";
import type { ImportSpec } from "../../../../runtime/ts-morph-helpers";

/**
 * What the two layout modifiers have in common: finding a SvelteKit `load`,
 * working out how it receives its event, and locating the object it returns.
 */

export type LoadFunction =
  ArrowFunction | FunctionExpression | FunctionDeclaration;

export function newProject(): Project {
  return new Project({
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
}

export function ensureNamedImports(
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

export function ensureImportSpec(sourceFile: SourceFile, spec: ImportSpec) {
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
export function findLoadFunction(sourceFile: SourceFile): LoadFunction | null {
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

/**
 * The single, final `return <expression>` of the load body, or null when the
 * body has early returns — those would need any insertion hoisted above them,
 * and guessing where is worse than refusing.
 */
export function findFinalReturn(
  fn: LoadFunction,
  body: Block,
): ReturnStatement | null {
  const statements = body.getStatements();
  const last = statements[statements.length - 1];
  if (!last || !Node.isReturnStatement(last)) return null;

  const returns = body
    .getDescendantsOfKind(SyntaxKind.ReturnStatement)
    .filter((r) => r.getFirstAncestor(isFunctionNode) === fn);
  if (returns.length !== 1) return null;

  return last;
}

/** The object literal a return statement yields, unwrapping parentheses. */
export function returnedObject(
  statement: ReturnStatement,
): ObjectLiteralExpression | null {
  let expression = statement.getExpression();
  while (expression && Node.isParenthesizedExpression(expression)) {
    expression = expression.getExpression();
  }
  if (!expression || !Node.isObjectLiteralExpression(expression)) return null;
  return expression;
}

export function hasProperty(
  object: ObjectLiteralExpression,
  name: string,
): boolean {
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

export function hasSpreadOf(
  object: ObjectLiteralExpression,
  expressionText: string,
): boolean {
  return object
    .getProperties()
    .some(
      (property) =>
        Node.isSpreadAssignment(property) &&
        property.getExpression().getText() === expressionText,
    );
}

/** How a load receives its event: not at all, by name, or destructured. */
export type EventParameter =
  | { kind: "none" }
  | { kind: "identifier"; name: string; param: ParameterDeclaration }
  | {
      kind: "binding";
      pattern: import("ts-morph").ObjectBindingPattern;
      param: ParameterDeclaration;
    }
  | { kind: "unsupported" };

export function inspectEventParameter(fn: LoadFunction): EventParameter {
  const params = fn.getParameters();
  if (params.length === 0) return { kind: "none" };
  if (params.length > 1) return { kind: "unsupported" };

  const param = params[0];
  if (param.getInitializer() || param.isRestParameter()) {
    return { kind: "unsupported" };
  }
  const nameNode = param.getNameNode();
  if (Node.isIdentifier(nameNode)) {
    return { kind: "identifier", name: nameNode.getText(), param };
  }
  if (Node.isObjectBindingPattern(nameNode)) {
    return { kind: "binding", pattern: nameNode, param };
  }
  return { kind: "unsupported" };
}
