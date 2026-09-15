import fs from "node:fs";
import {
  Project,
  QuoteKind,
  SyntaxKind,
  type ArrowFunction,
  type FunctionDeclaration,
  type FunctionExpression,
  type Node,
  type ObjectLiteralExpression,
  type SourceFile,
} from "ts-morph";
import type { ModifyOutcome } from "../core/types";

export interface LoadRevertSpec {
  /** Declarations in the load body to drop, by name. */
  variables: string[];
  /** `depends("<key>")` calls to drop. */
  dependsKeys: string[];
  /** Properties to drop from every object the load returns. */
  returnProps: string[];
}

type LoadFn = ArrowFunction | FunctionDeclaration | FunctionExpression;

/** The exported `load`, whether arrow, wrapped (`loadFlash(...)`) or a function. */
function findLoad(sf: SourceFile): LoadFn | undefined {
  const varDecl = sf.getVariableDeclaration("load");
  if (varDecl) {
    const vs = varDecl.getFirstAncestorByKind(SyntaxKind.VariableStatement);
    if (vs?.hasExportKeyword()) {
      const direct = varDecl.getInitializerIfKind(SyntaxKind.ArrowFunction);
      if (direct) return direct;
      const init = varDecl.getInitializer();
      const inner =
        init?.getFirstDescendantByKind(SyntaxKind.ArrowFunction) ??
        init?.getFirstDescendantByKind(SyntaxKind.FunctionExpression);
      if (inner) return inner;
    }
  }
  const fn = sf.getFunction("load");
  return fn?.isExported() ? fn : undefined;
}

function asObjectLiteral(
  node: Node | undefined,
): ObjectLiteralExpression | null {
  let expr = node;
  if (expr?.getKind() === SyntaxKind.ParenthesizedExpression) {
    expr = expr
      .asKindOrThrow(SyntaxKind.ParenthesizedExpression)
      .getExpression();
  }
  return expr?.getKind() === SyntaxKind.ObjectLiteralExpression
    ? expr.asKindOrThrow(SyntaxKind.ObjectLiteralExpression)
    : null;
}

function returnedObjects(fn: LoadFn): ObjectLiteralExpression[] {
  const body = fn.getBody();
  if (!body) return [];
  if (body.getKind() !== SyntaxKind.Block) {
    const obj = asObjectLiteral(body);
    return obj ? [obj] : [];
  }
  return body
    .getDescendantsOfKind(SyntaxKind.ReturnStatement)
    .map((ret) => asObjectLiteral(ret.getExpression()))
    .filter((obj): obj is ObjectLiteralExpression => obj !== null);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The inverse of the `modifyLayoutServer` family: drop the declarations,
 * `depends()` calls and returned properties an enable pattern added to the
 * exported `load`, then tidy what they leave behind (an unused `depends`
 * parameter, an `async` with nothing left to await).
 */
export function removeFromLoad(
  filePath: string,
  spec: LoadRevertSpec,
): ModifyOutcome {
  if (!fs.existsSync(filePath)) {
    return { status: "success", changed: false };
  }

  const original = fs.readFileSync(filePath, "utf8");
  const project = new Project({
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sf = project.addSourceFileAtPath(filePath);
  const fn = findLoad(sf);
  if (!fn) {
    return { status: "success", changed: false };
  }

  const body = fn.getBody();
  if (body?.getKind() === SyntaxKind.Block) {
    const block = body.asKindOrThrow(SyntaxKind.Block);
    const dependsRe =
      spec.dependsKeys.length > 0
        ? new RegExp(
            `^depends\\(\\s*['"](?:${spec.dependsKeys.map(escapeRegExp).join("|")})['"]\\s*\\)`,
          )
        : null;
    // One statement per pass: a removal invalidates its siblings.
    for (;;) {
      const stmt = block.getStatements().find((s) => {
        if (s.getKind() === SyntaxKind.VariableStatement) {
          return s
            .asKindOrThrow(SyntaxKind.VariableStatement)
            .getDeclarations()
            .some((d) => spec.variables.includes(d.getName()));
        }
        return (
          s.getKind() === SyntaxKind.ExpressionStatement &&
          dependsRe !== null &&
          dependsRe.test(s.getText())
        );
      });
      if (!stmt) break;
      stmt.remove();
    }
  }

  for (const obj of returnedObjects(fn)) {
    for (const name of spec.returnProps) {
      obj.getProperty(name)?.remove();
    }
  }

  const stillDepends = /\bdepends\s*\(/.test(fn.getBody()?.getText() ?? "");
  const first = fn.getParameters()[0];
  if (first && !stillDepends) {
    const nameNode = first.getNameNode();
    if (nameNode.getKind() === SyntaxKind.ObjectBindingPattern) {
      const pattern = nameNode.asKindOrThrow(SyntaxKind.ObjectBindingPattern);
      const elements = pattern.getElements();
      const kept = elements
        .filter((el) => el.getName() !== "depends")
        .map((el) => el.getText());
      if (kept.length !== elements.length) {
        const structure = first.getStructure();
        first.set({
          name: `{ ${kept.join(", ")} }`,
          type: structure.type,
          initializer: structure.initializer,
        });
      }
    }
  }

  if (
    fn.isAsync() &&
    (fn.getBody()?.getDescendantsOfKind(SyntaxKind.AwaitExpression).length ??
      0) === 0
  ) {
    fn.setIsAsync(false);
  }

  sf.formatText();

  // Removing the statements just above `return` takes the blank line that
  // separated them with it; put it back so the layout reads as it did.
  const finalBody = fn.getBody();
  if (finalBody?.getKind() === SyntaxKind.Block) {
    const statements = finalBody
      .asKindOrThrow(SyntaxKind.Block)
      .getStatements();
    const ret = statements[statements.length - 1];
    const prev = statements[statements.length - 2];
    if (ret?.getKind() === SyntaxKind.ReturnStatement && prev) {
      const between = sf.getFullText().slice(prev.getEnd(), ret.getStart());
      if ((between.match(/\n/g) ?? []).length < 2) {
        sf.insertText(prev.getEnd(), "\n");
      }
    }
  }

  sf.saveSync();
  return { status: "success", changed: sf.getFullText() !== original };
}
