import fs from "node:fs";
import { Project, QuoteKind, SyntaxKind, type ObjectLiteralExpression } from "ts-morph";

function getOrCreateObjectLiteralProperty(
  obj: ObjectLiteralExpression,
  name: string,
  initializer: string,
): ObjectLiteralExpression | null {
  const prop = obj.getProperty(name);
  if (!prop) {
    obj.addPropertyAssignment({ name, initializer });
    const added = obj.getProperty(name);
    if (!added || added.getKind() !== SyntaxKind.PropertyAssignment) return null;
    const init = (added as import("ts-morph").PropertyAssignment).getInitializer();
    if (!init || init.getKind() !== SyntaxKind.ObjectLiteralExpression) return null;
    return init as ObjectLiteralExpression;
  }

  if (prop.getKind() !== SyntaxKind.PropertyAssignment) return null;
  const init = (prop as import("ts-morph").PropertyAssignment).getInitializer();
  if (!init) return null;
  if (init.getKind() !== SyntaxKind.ObjectLiteralExpression) {
    (prop as import("ts-morph").PropertyAssignment).setInitializer(initializer);
    const init2 = (prop as import("ts-morph").PropertyAssignment).getInitializer();
    return init2 && init2.getKind() === SyntaxKind.ObjectLiteralExpression
      ? (init2 as ObjectLiteralExpression)
      : null;
  }

  return init as ObjectLiteralExpression;
}

export function modifySvelteConfig(svelteConfigPath: string) {
  if (!fs.existsSync(svelteConfigPath)) return false;

  const project = new Project({
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.addSourceFileAtPath(svelteConfigPath);

  const defaultExport = sourceFile.getExportAssignment((ea) => !ea.isExportEquals());
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

  if (!configObj) return false;

  const kitObj = getOrCreateObjectLiteralProperty(configObj, "kit", "{}");
  if (!kitObj) return false;

  const aliasObj = getOrCreateObjectLiteralProperty(kitObj, "alias", "{}");
  if (!aliasObj) return false;

  const existingLocales = aliasObj.getProperty("$locales");
  if (!existingLocales) {
    aliasObj.addPropertyAssignment({ name: "$locales", initializer: "'src/locales'" });
    sourceFile.formatText();
    sourceFile.saveSync();
    return true;
  }

  if (existingLocales.getKind() !== SyntaxKind.PropertyAssignment) return false;
  const init = (existingLocales as import("ts-morph").PropertyAssignment).getInitializer();
  const current = init?.getText()?.replace(/['"`]/g, "");
  if (current === "src/locales") return false;

  (existingLocales as import("ts-morph").PropertyAssignment).setInitializer(
    "'src/locales'",
  );
  sourceFile.formatText();
  sourceFile.saveSync();
  return true;
}
