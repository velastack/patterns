import fs from "node:fs";
import { dedent } from "ts-dedent";
import { Project, SyntaxKind } from "ts-morph";

export function modifyLayoutServer(layoutPath: string) {
  if (!fs.existsSync(layoutPath)) {
    // write file directly

    const snippet = dedent`
			export const load = async ({ locals }) => {
				return { user: locals.pb.authStore.record };
			};
		`;

    fs.writeFileSync(layoutPath, snippet);
    return;
  }

  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(layoutPath);

  // helper to add user property to an object literal if missing
  const addUserProp = (obj: import("ts-morph").ObjectLiteralExpression) => {
    const hasUser = !!obj.getProperty("user");
    if (!hasUser) {
      obj.addPropertyAssignment({
        name: "user",
        initializer: "locals.pb.authStore.record",
      });
    }
  };

  // find existing exported load (function or const with arrow)
  let loadArrow: import("ts-morph").ArrowFunction | undefined;
  let loadFn:
    | import("ts-morph").FunctionDeclaration
    | import("ts-morph").FunctionExpression
    | undefined;

  const varDecl = sourceFile.getVariableDeclaration("load");
  if (varDecl) {
    const vs = varDecl.getFirstAncestorByKind(SyntaxKind.VariableStatement);
    const isExported = !!vs?.hasExportKeyword();
    if (isExported) {
      const directArrow = varDecl.getInitializerIfKind(
        SyntaxKind.ArrowFunction,
      );
      if (directArrow) {
        loadArrow = directArrow;
      } else {
        const init = varDecl.getInitializer();
        if (init) {
          const innerArrow = init.getFirstDescendantByKind(
            SyntaxKind.ArrowFunction,
          );
          if (innerArrow) {
            loadArrow = innerArrow;
          } else {
            const innerFnExpr = init.getFirstDescendantByKind(
              SyntaxKind.FunctionExpression,
            );
            if (innerFnExpr) {
              loadFn = innerFnExpr;
            }
          }
        }
      }
    }
  }

  if (!loadArrow) {
    const maybeFn = sourceFile.getFunction("load");
    if (maybeFn && maybeFn.isExported()) {
      loadFn = maybeFn;
    }
  }

  // if no load found, create one
  if (!loadArrow && !loadFn) {
    sourceFile.addFunction({
      isExported: true,
      isAsync: true,
      name: "load",
      parameters: [{ name: "{ locals }" }],
      statements: `return { user: locals.pb.authStore.record };`,
    });
    sourceFile.formatText();
    sourceFile.saveSync();
    return;
  }

  // normalize function-like to a single handle
  const fnLike:
    | import("ts-morph").ArrowFunction
    | import("ts-morph").FunctionDeclaration
    | import("ts-morph").FunctionExpression = (loadArrow ?? loadFn!) as any;

  // ensure first parameter destructures locals, preserving existing information
  const params = fnLike.getParameters();
  if (params.length === 0) {
    fnLike.insertParameter(0, { name: "{ locals }" });
  } else {
    const first = params[0];
    const original = first.getStructure();
    const nameNode = first.getNameNode();
    if (nameNode.getKind() === SyntaxKind.ObjectBindingPattern) {
      const obp = nameNode as import("ts-morph").ObjectBindingPattern;
      const hasLocals = obp
        .getElements()
        .some((el) => el.getName() === "locals");
      if (!hasLocals) {
        const parts = obp
          .getElements()
          .map((el) => el.getText())
          .filter(Boolean);
        const tail = parts.length > 0 ? ", " + parts.join(", ") : "";
        first.set({
          name: `{ locals${tail} }`,
          type: original.type,
          initializer: (original as any).initializer,
        });
      }
    } else {
      const currentName = first.getName();
      if (currentName !== "locals") {
        first.set({
          name: `{ locals, ...${currentName} }`,
          type: original.type,
          initializer: (original as any).initializer,
        });
      }
    }
  }

  // add user to returned object literals without altering other properties
  if (loadArrow) {
    const body = loadArrow.getBody();
    if (body.getKind() === SyntaxKind.Block) {
      const returns = body.getDescendantsOfKind(SyntaxKind.ReturnStatement);
      returns.forEach((ret) => {
        const expr = ret.getExpression();
        if (!expr) return;
        if (expr.getKind() === SyntaxKind.ObjectLiteralExpression) {
          addUserProp(expr as import("ts-morph").ObjectLiteralExpression);
        } else if (expr.getKind() === SyntaxKind.ParenthesizedExpression) {
          const inner = (
            expr as import("ts-morph").ParenthesizedExpression
          ).getExpression();
          if (inner.getKind() === SyntaxKind.ObjectLiteralExpression) {
            addUserProp(inner as import("ts-morph").ObjectLiteralExpression);
          }
        }
      });
    } else {
      // concise body
      const bodyExpr = body as import("ts-morph").Expression;
      if (bodyExpr.getKind() === SyntaxKind.ParenthesizedExpression) {
        const inner = (
          bodyExpr as import("ts-morph").ParenthesizedExpression
        ).getExpression();
        if (inner.getKind() === SyntaxKind.ObjectLiteralExpression) {
          addUserProp(inner as import("ts-morph").ObjectLiteralExpression);
        }
      } else if (bodyExpr.getKind() === SyntaxKind.ObjectLiteralExpression) {
        addUserProp(bodyExpr as import("ts-morph").ObjectLiteralExpression);
      }
    }
  } else if (loadFn) {
    const body = loadFn.getBody();
    if (body) {
      const returns = body.getDescendantsOfKind(SyntaxKind.ReturnStatement);
      returns.forEach((ret) => {
        const expr = ret.getExpression();
        if (!expr) return;
        if (expr.getKind() === SyntaxKind.ObjectLiteralExpression) {
          addUserProp(expr as import("ts-morph").ObjectLiteralExpression);
        } else if (expr.getKind() === SyntaxKind.ParenthesizedExpression) {
          const inner = (
            expr as import("ts-morph").ParenthesizedExpression
          ).getExpression();
          if (inner.getKind() === SyntaxKind.ObjectLiteralExpression) {
            addUserProp(inner as import("ts-morph").ObjectLiteralExpression);
          }
        }
      });
    }
  }

  sourceFile.formatText();
  sourceFile.saveSync();
}
