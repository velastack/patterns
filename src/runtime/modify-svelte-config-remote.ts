import fs from "node:fs";
import path from "node:path";
import {
  Project,
  QuoteKind,
  SyntaxKind,
  type ObjectLiteralExpression,
} from "ts-morph";
import type { ModifyOutcome } from "../core/types";

const FAILURE_HINT = [
  "Enable SvelteKit remote functions and Svelte async in your Svelte config:",
  "",
  "kit: {",
  "  experimental: {",
  "    remoteFunctions: true,",
  "  },",
  "},",
  "compilerOptions: {",
  "  experimental: {",
  "    async: true,",
  "  },",
  "},",
].join("\n");

const NOT_FOUND_HINT = [
  "Create a Svelte config with remote functions and async enabled:",
  "",
  "/** @type {import('@sveltejs/kit').Config} */",
  "const config = {",
  "  kit: {",
  "    experimental: {",
  "      remoteFunctions: true,",
  "    },",
  "  },",
  "  compilerOptions: {",
  "    experimental: {",
  "      async: true,",
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

function ensureBooleanTrue(
  obj: ObjectLiteralExpression,
  name: string,
): boolean {
  const existing = obj.getProperty(name);
  if (!existing) {
    obj.addPropertyAssignment({ name, initializer: "true" });
    return true;
  }
  if (existing.getKind() !== SyntaxKind.PropertyAssignment) return false;
  const init = (
    existing as import("ts-morph").PropertyAssignment
  ).getInitializer();
  if (init?.getText() === "true") return false;
  (existing as import("ts-morph").PropertyAssignment).setInitializer("true");
  return true;
}

export function modifySvelteConfigRemote(
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

  let changed = false;

  const kitObj = getOrCreateObjectLiteralProperty(configObj, "kit", "{}");
  if (!kitObj) {
    return { status: "failed", message: FAILURE_HINT };
  }
  const kitExperimental = getOrCreateObjectLiteralProperty(
    kitObj,
    "experimental",
    "{}",
  );
  if (!kitExperimental) {
    return { status: "failed", message: FAILURE_HINT };
  }
  if (ensureBooleanTrue(kitExperimental, "remoteFunctions")) changed = true;

  const compilerObj = getOrCreateObjectLiteralProperty(
    configObj,
    "compilerOptions",
    "{}",
  );
  if (!compilerObj) {
    return { status: "failed", message: FAILURE_HINT };
  }
  const compilerExperimental = getOrCreateObjectLiteralProperty(
    compilerObj,
    "experimental",
    "{}",
  );
  if (!compilerExperimental) {
    return { status: "failed", message: FAILURE_HINT };
  }
  if (ensureBooleanTrue(compilerExperimental, "async")) changed = true;

  if (!changed) {
    return { status: "success", changed: false };
  }

  sourceFile.formatText();
  const newText = sourceFile.getFullText();
  if (newText === originalText) {
    return { status: "success", changed: false };
  }
  sourceFile.saveSync();
  return { status: "success", changed: true };
}

export function findSvelteConfigPath(root: string): string {
  const candidates = [
    "svelte.config.ts",
    "svelte.config.js",
    "svelte.config.mjs",
    "svelte.config.cjs",
  ];
  for (const relPath of candidates) {
    const absPath = path.join(root, relPath);
    if (fs.existsSync(absPath)) {
      return absPath;
    }
  }
  return path.join(root, candidates[1]);
}
