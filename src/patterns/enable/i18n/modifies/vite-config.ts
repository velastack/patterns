import fs from "node:fs";
import { Project, QuoteKind, SyntaxKind } from "ts-morph";

export function modifyViteConfig(viteConfigPath: string) {
  if (!fs.existsSync(viteConfigPath)) return false;

  const project = new Project({
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.addSourceFileAtPath(viteConfigPath);

  let changed = false;

  const hasImport = sourceFile
    .getImportDeclarations()
    .some((d) => d.getModuleSpecifierValue() === "wuchale/vite");

  if (!hasImport) {
    sourceFile.insertImportDeclaration(0, {
      namedImports: ["wuchale"],
      moduleSpecifier: "wuchale/vite",
    });
    changed = true;
  }

  const defineConfigCall = sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((ce) => ce.getExpression().getText() === "defineConfig");

  const configArg = defineConfigCall?.getArguments()?.[0];
  const configObj =
    configArg?.getKind() === SyntaxKind.ObjectLiteralExpression
      ? (configArg as import("ts-morph").ObjectLiteralExpression)
      : null;

  if (!configObj) {
    if (changed) {
      sourceFile.formatText();
      sourceFile.saveSync();
    }
    return changed;
  }

  const pluginsProp = configObj.getProperty("plugins");
  if (!pluginsProp) {
    configObj.addPropertyAssignment({ name: "plugins", initializer: "[wuchale()]" });
    sourceFile.formatText();
    sourceFile.saveSync();
    return true;
  }

  if (pluginsProp.getKind() !== SyntaxKind.PropertyAssignment) {
    if (changed) {
      sourceFile.formatText();
      sourceFile.saveSync();
    }
    return changed;
  }

  const pluginsInit = (
    pluginsProp as import("ts-morph").PropertyAssignment
  ).getInitializer();
  if (!pluginsInit) {
    (pluginsProp as import("ts-morph").PropertyAssignment).setInitializer(
      "[wuchale()]",
    );
    sourceFile.formatText();
    sourceFile.saveSync();
    return true;
  }

  if (pluginsInit.getKind() !== SyntaxKind.ArrayLiteralExpression) {
    if (changed) {
      sourceFile.formatText();
      sourceFile.saveSync();
    }
    return changed;
  }

  const arr = pluginsInit as import("ts-morph").ArrayLiteralExpression;
  const hasWuchale = arr
    .getElements()
    .some((el) => el.getText().replace(/\s/g, "") === "wuchale()");

  if (!hasWuchale) {
    arr.insertElement(0, "wuchale()");
    changed = true;
  }

  if (changed) {
    sourceFile.formatText();
    sourceFile.saveSync();
  }

  return changed;
}
