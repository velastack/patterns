import fs from "node:fs";
import { Project, SyntaxKind } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";

export function unmodifyHooksServer(hooksServerPath: string): ModifyOutcome {
  if (!fs.existsSync(hooksServerPath)) {
    return { status: "success", changed: false };
  }

  const originalSource = fs.readFileSync(hooksServerPath, "utf8");
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(hooksServerPath);

  const callExpr = sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((ce) => ce.getExpression().getText() === "handlePocketbase");
  if (!callExpr) return { status: "success", changed: false };

  const [firstArg] = callExpr.getArguments();
  if (!firstArg || firstArg.getKind() !== SyntaxKind.ObjectLiteralExpression) {
    return { status: "success", changed: false };
  }

  const optionsObj = firstArg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
  const apiProp = optionsObj.getProperty("api");
  if (!apiProp || apiProp.getKind() !== SyntaxKind.PropertyAssignment) {
    return { status: "success", changed: false };
  }

  const apiInit = (
    apiProp as import("ts-morph").PropertyAssignment
  ).getInitializer();
  if (!apiInit || apiInit.getKind() !== SyntaxKind.ObjectLiteralExpression) {
    return { status: "success", changed: false };
  }

  const apiObj = apiInit as import("ts-morph").ObjectLiteralExpression;
  const apiKeysProp = apiObj.getProperty("apiKeys");
  if (!apiKeysProp) {
    return { status: "success", changed: false };
  }

  apiKeysProp.remove();

  sourceFile.formatText();
  sourceFile.saveSync();

  return {
    status: "success",
    changed: sourceFile.getFullText() !== originalSource,
  };
}
