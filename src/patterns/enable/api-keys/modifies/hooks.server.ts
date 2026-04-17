import fs from "node:fs";
import dedent from "dedent";
import { Project, SyntaxKind } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";

const FAILURE_HINT = dedent`
  Configure handlePocketbase() with API keys in hooks.server.ts:

  handlePocketbase({
    api: {
      enabled: true,
      apiKeys: { enabled: true },
    },
  });
`;

const NOT_FOUND_HINT = dedent`
  Create src/hooks.server.ts with handlePocketbase:

  import { handlePocketbase } from 'velastack/handle';

  export const handle = handlePocketbase({
    api: {
      enabled: true,
      apiKeys: { enabled: true },
    },
  });
`;

export function modifyHooksServer(hooksServerPath: string): ModifyOutcome {
  if (!fs.existsSync(hooksServerPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const originalSource = fs.readFileSync(hooksServerPath, "utf8");
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(hooksServerPath);

  const callExpr = sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((ce) => ce.getExpression().getText() === "handlePocketbase");

  if (!callExpr) {
    return { status: "failed", message: FAILURE_HINT };
  }

  const args = callExpr.getArguments();
  if (args.length === 0) {
    callExpr.addArgument(
      `{ api: { enabled: true, apiKeys: { enabled: true } } }`,
    );
    sourceFile.formatText();
    sourceFile.saveSync();
    return { status: "success", changed: true };
  }

  const firstArg = args[0];
  if (firstArg.getKind() !== SyntaxKind.ObjectLiteralExpression) {
    callExpr.insertArgument(
      0,
      `{ api: { enabled: true, apiKeys: { enabled: true } } }`,
    );
    sourceFile.formatText();
    sourceFile.saveSync();
    return { status: "success", changed: true };
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
    return { status: "success", changed: true };
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

      const apiKeysProp = apiObj.getProperty("apiKeys");
      if (!apiKeysProp) {
        apiObj.addPropertyAssignment({
          name: "apiKeys",
          initializer: `{ enabled: true }`,
        });
      } else if (apiKeysProp.getKind() === SyntaxKind.PropertyAssignment) {
        const keysInit = (
          apiKeysProp as import("ts-morph").PropertyAssignment
        ).getInitializer();
        if (
          keysInit &&
          keysInit.getKind() === SyntaxKind.ObjectLiteralExpression
        ) {
          const keysObj =
            keysInit as import("ts-morph").ObjectLiteralExpression;
          const keysEnabled = keysObj.getProperty("enabled");
          if (!keysEnabled) {
            keysObj.addPropertyAssignment({
              name: "enabled",
              initializer: "true",
            });
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
  return {
    status: "success",
    changed: sourceFile.getFullText() !== originalSource,
  };
}
