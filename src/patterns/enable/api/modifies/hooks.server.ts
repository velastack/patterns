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
    callExpr.addArgument(`{ api: { enabled: true } }`);
    sourceFile.formatText();
    sourceFile.saveSync();
    return;
  }

  const firstArg = args[0];
  if (firstArg.getKind() !== SyntaxKind.ObjectLiteralExpression) {
    callExpr.insertArgument(0, `{ api: { enabled: true } }`);
    sourceFile.formatText();
    sourceFile.saveSync();
    return;
  }

  const optionsObj = firstArg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
  const apiProp = optionsObj.getProperty("api");

  if (!apiProp) {
    optionsObj.addPropertyAssignment({
      name: "api",
      initializer: `{ enabled: true }`,
    });
    sourceFile.formatText();
    sourceFile.saveSync();
    return;
  }

  if (apiProp.getKind() === SyntaxKind.PropertyAssignment) {
    const apiInit = (
      apiProp as import("ts-morph").PropertyAssignment
    ).getInitializer();
    if (apiInit && apiInit.getKind() === SyntaxKind.ObjectLiteralExpression) {
      const apiObj = apiInit as import("ts-morph").ObjectLiteralExpression;
      const enabledProp = apiObj.getProperty("enabled");
      if (!enabledProp) {
        apiObj.addPropertyAssignment({ name: "enabled", initializer: "true" });
      }
    }
  }

  sourceFile.formatText();
  sourceFile.saveSync();
}
