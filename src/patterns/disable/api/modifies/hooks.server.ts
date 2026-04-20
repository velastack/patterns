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

  if (!callExpr) {
    return { status: "success", changed: false };
  }

  const args = callExpr.getArguments();
  if (args.length === 0) {
    return { status: "success", changed: false };
  }

  const firstArg = args[0];
  if (firstArg.getKind() !== SyntaxKind.ObjectLiteralExpression) {
    return { status: "success", changed: false };
  }

  const optionsObj = firstArg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
  const apiProp = optionsObj.getProperty("api");
  if (!apiProp) {
    return { status: "success", changed: false };
  }

  apiProp.remove();

  if (optionsObj.getProperties().length === 0) {
    callExpr.removeArgument(0);
  }

  sourceFile.formatText();
  sourceFile.saveSync();

  return {
    status: "success",
    changed: sourceFile.getFullText() !== originalSource,
  };
}
