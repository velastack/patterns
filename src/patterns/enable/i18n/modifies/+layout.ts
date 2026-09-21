import fs from "node:fs";
import path from "node:path";
import dedent from "dedent";
import { Project, QuoteKind } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import {
  ensureImports,
  ensureNamedImport,
  formatLikeSource,
} from "../../../../runtime/ts-morph-helpers";

const IMPORT_SNIPPET = dedent`
  import { browser } from '$app/environment';
  import { loadLocale } from 'wuchale/load-utils';

  import { getLocale } from '$locales/main.url';
  import '$locales/main.loader.svelte';
  import '$locales/js.loader';
`;

/** The load `disable-i18n` looks for to take it out again. */
export const LOAD_STATEMENT = dedent`
  export const load = async ({ url, data }) => {
    const locale = getLocale(url);

    if (browser) {
      await loadLocale(locale);
    }

    return data;
  };
`;

/** The whole file, for a project that had no root `+layout.ts`. */
export const LOAD_SNIPPET = `${IMPORT_SNIPPET}\n\n${LOAD_STATEMENT}`;

const FAILURE_HINT = [
  "Merge the wuchale loader into your existing load function in +layout.ts:",
  "",
  LOAD_SNIPPET,
].join("\n");

export function ensureRootLayoutI18n(layoutPath: string): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    fs.mkdirSync(path.dirname(layoutPath), { recursive: true });
    fs.writeFileSync(layoutPath, LOAD_SNIPPET + "\n");
    return { status: "success", changed: true };
  }

  const existing = fs.readFileSync(layoutPath, "utf8");
  if (existing.includes("loadLocale") || existing.includes("translateUrl")) {
    return { status: "success", changed: false };
  }

  if (/\bexport\s+(const|function)\s+load\b/.test(existing)) {
    return { status: "failed", message: FAILURE_HINT };
  }

  // No load to merge with, but the file may hold other route options
  // (`export const prerender = true`, say), so the load is added to it
  // rather than written over it.
  const project = new Project({
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.addSourceFileAtPath(layoutPath);

  ensureNamedImport(sourceFile, "$app/environment", "browser");
  ensureNamedImport(sourceFile, "wuchale/load-utils", "loadLocale");
  ensureNamedImport(sourceFile, "$locales/main.url", "getLocale");
  ensureImports(sourceFile, [
    { moduleSpecifier: "$locales/main.loader.svelte" },
    { moduleSpecifier: "$locales/js.loader" },
  ]);

  sourceFile.addStatements(`\n${LOAD_STATEMENT}\n`);
  formatLikeSource(sourceFile);
  sourceFile.saveSync();
  return { status: "success", changed: true };
}
