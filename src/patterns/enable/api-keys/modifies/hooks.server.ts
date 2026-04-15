import { Project, SyntaxKind } from "ts-morph";

export function modifyHooksServer(hooksServerPath: string) {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(hooksServerPath);

  const callExpr = sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((ce) => ce.getExpression().getText() === "handlePocketbase");

  if (!callExpr) {
    sourceFile.saveSync();
    return;
  }

  const args = callExpr.getArguments();
  if (args.length === 0) {
    callExpr.addArgument(
      `{ api: { enabled: true, apiKeys: { enabled: true } } }`,
    );
    sourceFile.formatText();
    sourceFile.saveSync();
    return;
  }

  const firstArg = args[0];
  if (firstArg.getKind() !== SyntaxKind.ObjectLiteralExpression) {
    callExpr.insertArgument(
      0,
      `{ api: { enabled: true, apiKeys: { enabled: true } } }`,
    );
    sourceFile.formatText();
    sourceFile.saveSync();
    return;
  }

  const optionsObj = firstArg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);

  const apiProp = optionsObj.getProperty("api");
  if (!apiProp) {
    optionsObj.addPropertyAssignment({
      name: "api",
      initializer: `{ enabled: true, apiKeys: { enabled: true } }`,
    });
    sourceFile.formatText();
    sourceFile.saveSync();
    return;
  }

  if (apiProp.getKind() === SyntaxKind.PropertyAssignment) {
    const apiInit = (apiProp as import("ts-morph").PropertyAssignment).getInitializer();
    if (apiInit && apiInit.getKind() === SyntaxKind.ObjectLiteralExpression) {
      const apiObj = apiInit as import("ts-morph").ObjectLiteralExpression;
      const enabledProp = apiObj.getProperty("enabled");
      if (!enabledProp) {
        apiObj.addPropertyAssignment({ name: "enabled", initializer: "true" });
      }

      const apiKeysProp = apiObj.getProperty("apiKeys");
      if (!apiKeysProp) {
        apiObj.addPropertyAssignment({
          name: "apiKeys",
          initializer: `{ enabled: true }`,
        });
      } else if (apiKeysProp.getKind() === SyntaxKind.PropertyAssignment) {
        const keysInit = (apiKeysProp as import("ts-morph").PropertyAssignment).getInitializer();
        if (keysInit && keysInit.getKind() === SyntaxKind.ObjectLiteralExpression) {
          const keysObj = keysInit as import("ts-morph").ObjectLiteralExpression;
          const keysEnabled = keysObj.getProperty("enabled");
          if (!keysEnabled) {
            keysObj.addPropertyAssignment({ name: "enabled", initializer: "true" });
          }
        } else {
          (apiKeysProp as import("ts-morph").PropertyAssignment).setInitializer(
            `{ enabled: true }`,
          );
        }
      }
    }
  }

  sourceFile.formatText();
  sourceFile.saveSync();
}
