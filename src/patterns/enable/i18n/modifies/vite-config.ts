import fs from "node:fs";
import { Project, QuoteKind, SyntaxKind } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";

const FAILURE_HINT = [
  "Add the wuchale plugin to your Vite config:",
  "",
  "import { wuchale } from 'wuchale/vite';",
  "",
  "export default defineConfig({",
  "  plugins: [wuchale(), /* ...existing plugins */],",
  "});",
].join("\n");

const NOT_FOUND_HINT = [
  "Create a Vite config with the wuchale plugin:",
  "",
  "import { defineConfig } from 'vite';",
  "import { wuchale } from 'wuchale/vite';",
  "",
  "export default defineConfig({",
  "  plugins: [wuchale()],",
  "});",
].join("\n");

export function modifyViteConfig(viteConfigPath: string): ModifyOutcome {
  if (!fs.existsSync(viteConfigPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const project = new Project({
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.addSourceFileAtPath(viteConfigPath);

  let changed = false;
  let failed = false;

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
    failed = true;
  } else {
    const pluginsProp = configObj.getProperty("plugins");
    if (!pluginsProp) {
      configObj.addPropertyAssignment({
        name: "plugins",
        initializer: "[wuchale()]",
      });
      changed = true;
    } else if (pluginsProp.getKind() !== SyntaxKind.PropertyAssignment) {
      failed = true;
    } else {
      const pluginsInit = (
        pluginsProp as import("ts-morph").PropertyAssignment
      ).getInitializer();

      if (!pluginsInit) {
        (pluginsProp as import("ts-morph").PropertyAssignment).setInitializer(
          "[wuchale()]",
        );
        changed = true;
      } else if (pluginsInit.getKind() !== SyntaxKind.ArrayLiteralExpression) {
        failed = true;
      } else {
        const arr = pluginsInit as import("ts-morph").ArrayLiteralExpression;
        const hasWuchale = arr
          .getElements()
          .some((el) => el.getText().replace(/\s/g, "") === "wuchale()");

        if (!hasWuchale) {
          arr.insertElement(0, "wuchale()");
          changed = true;
        }
      }
    }
  }

  if (changed) {
    sourceFile.formatText();
    sourceFile.saveSync();
  }

  if (failed) {
    return { status: "failed", message: FAILURE_HINT };
  }

  return { status: "success", changed };
}
