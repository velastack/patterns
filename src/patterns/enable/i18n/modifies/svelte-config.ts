import fs from "node:fs";
import {
  Project,
  QuoteKind,
  SyntaxKind,
  type ObjectLiteralExpression,
} from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";

const FAILURE_HINT = [
  "Add the $locales alias to your Svelte config:",
  "",
  "kit: {",
  "  alias: {",
  "    $locales: 'src/locales',",
  "  },",
  "},",
].join("\n");

const NOT_FOUND_HINT = [
  "Create a Svelte config with the $locales alias:",
  "",
  "/** @type {import('@sveltejs/kit').Config} */",
  "const config = {",
  "  kit: {",
  "    alias: {",
  "      $locales: 'src/locales',",
  "    },",
  "  },",
  "};",
  "",
  "export default config;",
].join("\n");

function getOrCreateObjectLiteralProperty(
  obj: ObjectLiteralExpression,
  name: string,
  initializer: string,
): ObjectLiteralExpression | null {
  const prop = obj.getProperty(name);
  if (!prop) {
    obj.addPropertyAssignment({ name, initializer });
    const added = obj.getProperty(name);
    if (!added || added.getKind() !== SyntaxKind.PropertyAssignment)
      return null;
    const init = (
      added as import("ts-morph").PropertyAssignment
    ).getInitializer();
    if (!init || init.getKind() !== SyntaxKind.ObjectLiteralExpression)
      return null;
    return init as ObjectLiteralExpression;
  }

  if (prop.getKind() !== SyntaxKind.PropertyAssignment) return null;
  const init = (prop as import("ts-morph").PropertyAssignment).getInitializer();
  if (!init) return null;
  if (init.getKind() !== SyntaxKind.ObjectLiteralExpression) {
    (prop as import("ts-morph").PropertyAssignment).setInitializer(initializer);
    const init2 = (
      prop as import("ts-morph").PropertyAssignment
    ).getInitializer();
    return init2 && init2.getKind() === SyntaxKind.ObjectLiteralExpression
      ? (init2 as ObjectLiteralExpression)
      : null;
  }

  return init as ObjectLiteralExpression;
}

export function modifySvelteConfig(svelteConfigPath: string): ModifyOutcome {
  if (!fs.existsSync(svelteConfigPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const project = new Project({
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.addSourceFileAtPath(svelteConfigPath);

  const defaultExport = sourceFile.getExportAssignment(
    (ea) => !ea.isExportEquals(),
  );
  const exportedExpr = defaultExport?.getExpression();

  let configObj: ObjectLiteralExpression | null = null;
  if (exportedExpr?.getKind() === SyntaxKind.ObjectLiteralExpression) {
    configObj = exportedExpr as ObjectLiteralExpression;
  } else if (exportedExpr?.getKind() === SyntaxKind.Identifier) {
    const ident = exportedExpr.getText();
    const varDecl = sourceFile.getVariableDeclaration(ident);
    const init = varDecl?.getInitializer();
    if (init?.getKind() === SyntaxKind.ObjectLiteralExpression) {
      configObj = init as ObjectLiteralExpression;
    }
  }

  if (!configObj) {
    return { status: "failed", message: FAILURE_HINT };
  }

  const kitObj = getOrCreateObjectLiteralProperty(configObj, "kit", "{}");
  if (!kitObj) {
    return { status: "failed", message: FAILURE_HINT };
  }

  const aliasObj = getOrCreateObjectLiteralProperty(kitObj, "alias", "{}");
  if (!aliasObj) {
    return { status: "failed", message: FAILURE_HINT };
  }

  const existingLocales = aliasObj.getProperty("$locales");
  if (!existingLocales) {
    aliasObj.addPropertyAssignment({
      name: "$locales",
      initializer: "'src/locales'",
    });
    sourceFile.formatText();
    sourceFile.saveSync();
    return { status: "success", changed: true };
  }

  if (existingLocales.getKind() !== SyntaxKind.PropertyAssignment) {
    return { status: "failed", message: FAILURE_HINT };
  }
  const init = (
    existingLocales as import("ts-morph").PropertyAssignment
  ).getInitializer();
  const current = init?.getText()?.replace(/['"`]/g, "");
  if (current === "src/locales") return { status: "success", changed: false };

  (existingLocales as import("ts-morph").PropertyAssignment).setInitializer(
    "'src/locales'",
  );
  sourceFile.formatText();
  sourceFile.saveSync();
  return { status: "success", changed: true };
}
