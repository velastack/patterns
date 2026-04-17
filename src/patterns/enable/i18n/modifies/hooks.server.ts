import fs from "node:fs";
import dedent from "dedent";
import { Project, QuoteKind, SyntaxKind } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";

const FAILURE_HINT = dedent`
  Wrap your exported handle with the wuchale i18n handler:

  import { sequence } from '@sveltejs/kit/hooks';
  import { runWithLocale, loadLocales } from 'wuchale/load-utils/server';
  import { getLocale } from '$locales/main.url';
  import { locales } from '$locales/data';
  import * as main from '$locales/main.loader.server.svelte.js';
  import * as js from '$locales/js.loader.server.js';

  loadLocales(main.key, main.loadIDs, main.loadCatalog, locales);
  loadLocales(js.key, js.loadIDs, js.loadCatalog, locales);

  const handleWuchale = async ({ event, resolve }: any) => {
    const locale = getLocale(event.url);
    return await runWithLocale(locale, () =>
      resolve(event, {
        transformPageChunk: ({ html }: { html: string }) =>
          html.replace('%sveltekit.lang%', locale),
      }),
    );
  };

  export const handle = sequence(handleWuchale, /* your existing handle */);
`;

const NOT_FOUND_HINT = dedent`
  Create src/hooks.server.ts with an i18n handle:

  import { sequence } from '@sveltejs/kit/hooks';
  import { runWithLocale, loadLocales } from 'wuchale/load-utils/server';
  import { getLocale } from '$locales/main.url';
  import { locales } from '$locales/data';
  import * as main from '$locales/main.loader.server.svelte.js';
  import * as js from '$locales/js.loader.server.js';

  loadLocales(main.key, main.loadIDs, main.loadCatalog, locales);
  loadLocales(js.key, js.loadIDs, js.loadCatalog, locales);

  const handleWuchale = async ({ event, resolve }: any) => {
    const locale = getLocale(event.url);
    return await runWithLocale(locale, () =>
      resolve(event, {
        transformPageChunk: ({ html }: { html: string }) =>
          html.replace('%sveltekit.lang%', locale),
      }),
    );
  };

  export const handle = handleWuchale;
`;

function ensureNamedImport(
  sourceFile: import("ts-morph").SourceFile,
  moduleSpecifier: string,
  name: string,
) {
  const existing = sourceFile
    .getImportDeclarations()
    .find((d) => d.getModuleSpecifierValue() === moduleSpecifier);
  if (existing) {
    const has = existing.getNamedImports().some((ni) => ni.getName() === name);
    if (!has) existing.addNamedImport(name);
    return;
  }
  sourceFile.addImportDeclaration({ namedImports: [name], moduleSpecifier });
}

function ensureNamespaceImport(
  sourceFile: import("ts-morph").SourceFile,
  moduleSpecifier: string,
  ns: string,
) {
  const existing = sourceFile
    .getImportDeclarations()
    .find((d) => d.getModuleSpecifierValue() === moduleSpecifier);
  if (existing) return;
  sourceFile.addImportDeclaration({ namespaceImport: ns, moduleSpecifier });
}

export function modifyHooksServerI18n(hooksServerPath: string): ModifyOutcome {
  if (!fs.existsSync(hooksServerPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const original = fs.readFileSync(hooksServerPath, "utf8");
  if (original.includes("runWithLocale") || original.includes("loadLocales(")) {
    return { status: "success", changed: false };
  }

  const project = new Project({
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.addSourceFileAtPath(hooksServerPath);

  const handleDecl = sourceFile.getVariableDeclaration("handle");
  if (!handleDecl) {
    return { status: "failed", message: FAILURE_HINT };
  }

  const handleStmt = handleDecl.getFirstAncestorByKind(
    SyntaxKind.VariableStatement,
  );
  if (!handleStmt?.hasExportKeyword()) {
    return { status: "failed", message: FAILURE_HINT };
  }

  ensureNamedImport(sourceFile, "@sveltejs/kit/hooks", "sequence");
  ensureNamedImport(sourceFile, "wuchale/load-utils/server", "runWithLocale");
  ensureNamedImport(sourceFile, "wuchale/load-utils/server", "loadLocales");
  ensureNamedImport(sourceFile, "$locales/main.url", "getLocale");
  ensureNamedImport(sourceFile, "$locales/data", "locales");
  ensureNamespaceImport(
    sourceFile,
    "$locales/main.loader.server.svelte.js",
    "main",
  );
  ensureNamespaceImport(sourceFile, "$locales/js.loader.server.js", "js");

  const statements = sourceFile.getStatements();
  const handleStmtIndex = statements.findIndex((s) => s === handleStmt);
  const i18nHandleName = "handleWuchale";

  const startupSnippet = dedent`
    loadLocales(main.key, main.loadIDs, main.loadCatalog, locales);
    loadLocales(js.key, js.loadIDs, js.loadCatalog, locales);
  `;

  const i18nHandleSnippet = dedent`
    const ${i18nHandleName} = async ({ event, resolve }: any) => {
      const locale = getLocale(event.url);
      return await runWithLocale(locale, () =>
        resolve(event, {
          transformPageChunk: ({ html }: { html: string }) =>
            html.replace('%sveltekit.lang%', locale)
        })
      );
    };
  `;

  if (handleStmtIndex >= 0) {
    sourceFile.insertStatements(
      handleStmtIndex,
      `\n${startupSnippet}\n\n${i18nHandleSnippet}\n`,
    );
  } else {
    sourceFile.addStatements(`\n${startupSnippet}\n\n${i18nHandleSnippet}\n`);
  }

  const init = handleDecl.getInitializer();
  if (!init) {
    return { status: "failed", message: FAILURE_HINT };
  }

  const initText = init.getText();
  if (initText.includes(i18nHandleName) || initText.includes("runWithLocale")) {
    return { status: "success", changed: false };
  }

  handleDecl.setInitializer(`sequence(${i18nHandleName}, ${initText})`);
  sourceFile.formatText();
  sourceFile.saveSync();
  return { status: "success", changed: true };
}
