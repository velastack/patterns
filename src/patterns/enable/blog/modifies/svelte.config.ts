import fs from "node:fs";
import dedent from "dedent";
import {
  Project,
  QuoteKind,
  SyntaxKind,
  type ArrayLiteralExpression,
  type ObjectLiteralExpression,
} from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import { ensureImports } from "../../../../runtime/ts-morph-helpers";

const FAILURE_HINT = dedent`
  Enable mdsvex in your svelte.config.js:

  import { mdsvex } from 'mdsvex';

  const config = {
    extensions: ['.svelte', '.svx'],
    preprocess: [mdsvex()],
    // ...
  };
`;

const NOT_FOUND_HINT = dedent`
  Create a Svelte config with mdsvex enabled:

  import adapter from '@sveltejs/adapter-auto';
  import { mdsvex } from 'mdsvex';

  const config = {
    extensions: ['.svelte', '.svx'],
    preprocess: [mdsvex()],
    kit: { adapter: adapter() },
  };

  export default config;
`;

function getConfigObject(
  sourceFile: import("ts-morph").SourceFile,
): ObjectLiteralExpression | null {
  const defaultExport = sourceFile.getExportAssignment(
    (ea) => !ea.isExportEquals(),
  );
  const exportedExpr = defaultExport?.getExpression();
  if (exportedExpr?.getKind() === SyntaxKind.ObjectLiteralExpression) {
    return exportedExpr as ObjectLiteralExpression;
  }
  if (exportedExpr?.getKind() === SyntaxKind.Identifier) {
    const ident = exportedExpr.getText();
    const varDecl = sourceFile.getVariableDeclaration(ident);
    const init = varDecl?.getInitializer();
    if (init?.getKind() === SyntaxKind.ObjectLiteralExpression) {
      return init as ObjectLiteralExpression;
    }
  }
  return null;
}

function ensureExtensionsSvx(obj: ObjectLiteralExpression): boolean {
  const existing = obj.getProperty("extensions");
  if (!existing) {
    obj.addPropertyAssignment({
      name: "extensions",
      initializer: "['.svelte', '.svx']",
    });
    return true;
  }
  if (existing.getKind() !== SyntaxKind.PropertyAssignment) return false;
  const init = (
    existing as import("ts-morph").PropertyAssignment
  ).getInitializer();
  if (!init || init.getKind() !== SyntaxKind.ArrayLiteralExpression) {
    (existing as import("ts-morph").PropertyAssignment).setInitializer(
      "['.svelte', '.svx']",
    );
    return true;
  }
  const arr = init as ArrayLiteralExpression;
  const hasSvx = arr
    .getElements()
    .some((el) => el.getText().replace(/['"`]/g, "") === ".svx");
  if (hasSvx) return false;
  arr.addElement("'.svx'");
  return true;
}

function ensurePreprocessMdsvex(obj: ObjectLiteralExpression): boolean {
  const existing = obj.getProperty("preprocess");
  if (!existing) {
    obj.addPropertyAssignment({
      name: "preprocess",
      initializer: "[mdsvex()]",
    });
    return true;
  }
  if (existing.getKind() !== SyntaxKind.PropertyAssignment) return false;
  const init = (
    existing as import("ts-morph").PropertyAssignment
  ).getInitializer();
  if (!init) {
    (existing as import("ts-morph").PropertyAssignment).setInitializer(
      "[mdsvex()]",
    );
    return true;
  }
  if (init.getKind() === SyntaxKind.ArrayLiteralExpression) {
    const arr = init as ArrayLiteralExpression;
    const hasMdsvex = arr
      .getElements()
      .some((el) => /\bmdsvex\s*\(/.test(el.getText()));
    if (hasMdsvex) return false;
    arr.addElement("mdsvex()");
    return true;
  }
  const text = init.getText();
  if (/\bmdsvex\s*\(/.test(text)) return false;
  (existing as import("ts-morph").PropertyAssignment).setInitializer(
    `[${text}, mdsvex()]`,
  );
  return true;
}

export function modifySvelteConfigMdsvex(
  svelteConfigPath: string,
): ModifyOutcome {
  if (!fs.existsSync(svelteConfigPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const project = new Project({
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.addSourceFileAtPath(svelteConfigPath);
  const originalText = sourceFile.getFullText();

  const configObj = getConfigObject(sourceFile);
  if (!configObj) {
    return { status: "failed", message: FAILURE_HINT };
  }

  let changed = false;
  if (ensureExtensionsSvx(configObj)) changed = true;
  if (ensurePreprocessMdsvex(configObj)) changed = true;

  if (!changed) {
    return { status: "success", changed: false };
  }

  ensureImports(sourceFile, [
    { namedImports: ["mdsvex"], moduleSpecifier: "mdsvex" },
  ]);

  sourceFile.formatText();
  const newText = sourceFile.getFullText();
  if (newText === originalText) {
    return { status: "success", changed: false };
  }
  sourceFile.saveSync();
  return { status: "success", changed: true };
}
