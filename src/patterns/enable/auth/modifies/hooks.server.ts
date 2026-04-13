import { Project, SyntaxKind } from "ts-morph";

export function modifyHooksServer(hooksServerPath: string) {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(hooksServerPath);

  // Find the handlePocketbase(...) call
  const callExpr = sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((ce) => ce.getExpression().getText() === "handlePocketbase");

  if (!callExpr) {
    sourceFile.saveSync();
    return;
  }

  const args = callExpr.getArguments();
  if (args.length === 0) {
    // Create an options object if missing
    callExpr.addArgument(`{ auth: { protectedRoutes: ['/(app)'] } }`);
    sourceFile.formatText();
    sourceFile.saveSync();
    return;
  }

  const firstArg = args[0];
  if (firstArg.getKind() !== SyntaxKind.ObjectLiteralExpression) {
    // Replace non-object first arg with an object including auth
    callExpr.insertArgument(0, `{ auth: { protectedRoutes: ['/(app)'] } }`);
    sourceFile.formatText();
    sourceFile.saveSync();
    return;
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
    return;
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
          // Replace non-array with desired value
          (prProp as import("ts-morph").PropertyAssignment).setInitializer(
            `['/(app)']`,
          );
        }
      }
    }
  }

  sourceFile.formatText();
  sourceFile.saveSync();
}
