import fs from "node:fs";
import dedent from "dedent";
import { Project, QuoteKind, type Statement } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import { LOAD_STATEMENT } from "../../../enable/i18n/modifies/+layout";
import {
  ensureBlankLineAfterImports,
  isEffectivelyEmpty,
  pruneUnusedImports,
  removeImportByModuleSpecifier,
  removeStatementWithComments,
  formatLikeSource,
} from "../../../../runtime/ts-morph-helpers";

const FAILURE_HINT = dedent`
  src/routes/+layout.ts still loads wuchale locales. Remove these from it:

  import { browser } from '$app/environment';
  import { loadLocale } from 'wuchale/load-utils';
  import { getLocale } from '$locales/main.url';
  import '$locales/main.loader.svelte';
  import '$locales/js.loader';

  and the loadLocale(...) call inside load().
`;

const SIDE_EFFECT_MODULES = [
  "$locales/main.loader.svelte",
  "$locales/js.loader",
];
const BINDING_MODULES = [
  "$app/environment",
  "wuchale/load-utils",
  "$locales/main.url",
];

function normalize(source: string): string {
  return source.replace(/["']/g, "'").replace(/\s+/g, "");
}

/**
 * Undo `ensureRootLayoutI18n`: drop the wuchale load and its imports, leaving
 * whatever else the file holds. A file enable-i18n wrote whole comes out
 * empty, for the caller to delete.
 */
export function unmodifyRootLayoutI18n(layoutPath: string): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "success", changed: false };
  }

  const original = fs.readFileSync(layoutPath, "utf8");
  if (!original.includes("loadLocale") && !original.includes("$locales")) {
    return { status: "success", changed: false };
  }

  const project = new Project({
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.addSourceFileAtPath(layoutPath);

  const loadStatement: Statement | undefined =
    sourceFile
      .getVariableStatements()
      .find((s) => s.getDeclarations().some((d) => d.getName() === "load")) ??
    sourceFile.getFunction("load");

  if (loadStatement) {
    // A load that grew code of its own needs a hand; only the one enable-i18n
    // wrote is safe to take out wholesale.
    if (normalize(loadStatement.getText()) !== normalize(LOAD_STATEMENT)) {
      return { status: "failed", message: FAILURE_HINT };
    }
    removeStatementWithComments(sourceFile, loadStatement);
  }

  for (const moduleSpecifier of SIDE_EFFECT_MODULES) {
    removeImportByModuleSpecifier(sourceFile, moduleSpecifier);
  }
  pruneUnusedImports(sourceFile, BINDING_MODULES);

  if (isEffectivelyEmpty(sourceFile)) {
    // Emptied rather than removed: the runtime turns an empty +layout.ts into
    // a delete entry, so the removal is written and reported like any other.
    fs.writeFileSync(layoutPath, "", "utf8");
    return { status: "success", changed: true };
  }

  formatLikeSource(sourceFile);
  ensureBlankLineAfterImports(sourceFile);
  sourceFile.saveSync();
  return {
    status: "success",
    changed: sourceFile.getFullText() !== original,
  };
}
