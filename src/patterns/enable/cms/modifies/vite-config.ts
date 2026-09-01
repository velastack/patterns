import fs from "node:fs";
import {
  Project,
  QuoteKind,
  SyntaxKind,
  type ArrayLiteralExpression,
  type ObjectLiteralExpression,
  type PropertyAssignment,
} from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";

const FAILURE_HINT = [
  "Add the CMS plugin to your Vite config, ahead of sveltekit():",
  "",
  "import { cms } from '@velastack/cms/vite';",
  "",
  "export default defineConfig({",
  "  plugins: [cms(), sveltekit(), /* ...existing plugins */],",
  "});",
].join("\n");

const NOT_FOUND_HINT = [
  "Create a Vite config with the CMS plugin ahead of sveltekit():",
  "",
  "import { defineConfig } from 'vite';",
  "import { sveltekit } from '@sveltejs/kit/vite';",
  "import { cms } from '@velastack/cms/vite';",
  "",
  "export default defineConfig({",
  "  plugins: [cms(), sveltekit()],",
  "});",
].join("\n");

function elementName(text: string): string {
  return text.replace(/\s/g, "");
}

/**
 * Registers `cms()` from `@velastack/cms/vite` in the Vite plugin list, just
 * ahead of `sveltekit()`. Only the plugin array is touched, so the inline
 * `sveltekit({ ... })` shape the templates use is left alone.
 */
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
    .some((d) => d.getModuleSpecifierValue() === "@velastack/cms/vite");

  if (!hasImport) {
    sourceFile.insertImportDeclaration(0, {
      namedImports: ["cms"],
      moduleSpecifier: "@velastack/cms/vite",
    });
    changed = true;
  }

  const defineConfigCall = sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((ce) => ce.getExpression().getText() === "defineConfig");

  const configArg = defineConfigCall?.getArguments()?.[0];
  const configObj =
    configArg?.getKind() === SyntaxKind.ObjectLiteralExpression
      ? (configArg as ObjectLiteralExpression)
      : null;

  if (!configObj) {
    failed = true;
  } else {
    const pluginsProp = configObj.getProperty("plugins");
    if (!pluginsProp) {
      configObj.addPropertyAssignment({
        name: "plugins",
        initializer: "[cms()]",
      });
      changed = true;
    } else if (pluginsProp.getKind() !== SyntaxKind.PropertyAssignment) {
      failed = true;
    } else {
      const pluginsInit = (pluginsProp as PropertyAssignment).getInitializer();

      if (!pluginsInit) {
        (pluginsProp as PropertyAssignment).setInitializer("[cms()]");
        changed = true;
      } else if (pluginsInit.getKind() !== SyntaxKind.ArrayLiteralExpression) {
        failed = true;
      } else {
        const arr = pluginsInit as ArrayLiteralExpression;
        const elements = arr.getElements();
        const hasCms = elements.some((el) =>
          elementName(el.getText()).startsWith("cms("),
        );

        if (!hasCms) {
          const sveltekitIndex = elements.findIndex((el) =>
            elementName(el.getText()).startsWith("sveltekit("),
          );
          arr.insertElement(
            sveltekitIndex === -1 ? 0 : sveltekitIndex,
            "cms()",
          );
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
