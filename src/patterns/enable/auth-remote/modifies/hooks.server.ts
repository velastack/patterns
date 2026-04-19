import fs from "node:fs";
import dedent from "dedent";
import { Project, SyntaxKind } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";

const FAILURE_HINT = dedent`
  Configure handlePocketbase() with the auth option in hooks.server.ts:

  handlePocketbase({
    auth: { protectedRoutes: ['/(app)'] },
  });
`;

const NOT_FOUND_HINT = dedent`
  Create src/hooks.server.ts with handlePocketbase:

  import { handlePocketbase } from 'velastack/handle';

  export const handle = handlePocketbase({
    auth: { protectedRoutes: ['/(app)'] },
  });
`;

export function modifyHooksServer(hooksServerPath: string): ModifyOutcome {
  if (!fs.existsSync(hooksServerPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const originalSource = fs.readFileSync(hooksServerPath, "utf8");
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(hooksServerPath);

  // Find the handlePocketbase(...) call
  const callExpr = sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((ce) => ce.getExpression().getText() === "handlePocketbase");

  if (!callExpr) {
    return { status: "failed", message: FAILURE_HINT };
  }

  const args = callExpr.getArguments();
  if (args.length === 0) {
    callExpr.addArgument(`{ auth: { protectedRoutes: ['/(app)'] } }`);
    sourceFile.formatText();
    sourceFile.saveSync();
    return { status: "success", changed: true };
  }

  const firstArg = args[0];
  if (firstArg.getKind() !== SyntaxKind.ObjectLiteralExpression) {
    callExpr.insertArgument(0, `{ auth: { protectedRoutes: ['/(app)'] } }`);
    sourceFile.formatText();
    sourceFile.saveSync();
    return { status: "success", changed: true };
  }

  const optionsObj = firstArg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);

  // Ensure auth property exists
  const authProp = optionsObj.getProperty("auth");
  if (!authProp) {
    optionsObj.addPropertyAssignment({
      name: "auth",
      initializer: `{ protectedRoutes: ['/(app)'] }`,
    });
    sourceFile.formatText();
    sourceFile.saveSync();
    return { status: "success", changed: true };
  }

  // If auth exists, ensure protectedRoutes includes '/(app)'
  if (authProp.getKind() === SyntaxKind.PropertyAssignment) {
    const authInit = (
      authProp as import("ts-morph").PropertyAssignment
    ).getInitializer();
    if (authInit && authInit.getKind() === SyntaxKind.ObjectLiteralExpression) {
      const authObj = authInit as import("ts-morph").ObjectLiteralExpression;
      const prProp = authObj.getProperty("protectedRoutes");
      if (!prProp) {
        authObj.addPropertyAssignment({
          name: "protectedRoutes",
          initializer: `['/(app)']`,
        });
      } else if (prProp.getKind() === SyntaxKind.PropertyAssignment) {
        const prInit = (
          prProp as import("ts-morph").PropertyAssignment
        ).getInitializer();
        if (prInit && prInit.getKind() === SyntaxKind.ArrayLiteralExpression) {
          const arr = prInit as import("ts-morph").ArrayLiteralExpression;
          const hasApp = arr
            .getElements()
            .some((el) => el.getText().replace(/['"`]/g, "") === "/(app)");
          if (!hasApp) {
            arr.addElement(`'/(app)'`);
          }
        } else {
          (prProp as import("ts-morph").PropertyAssignment).setInitializer(
            `['/(app)']`,
          );
        }
      }
    }
  }

  sourceFile.formatText();
  sourceFile.saveSync();
  return {
    status: "success",
    changed: sourceFile.getFullText() !== originalSource,
  };
}
