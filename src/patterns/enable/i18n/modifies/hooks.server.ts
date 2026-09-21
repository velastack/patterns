import fs from "node:fs";
import path from "node:path";
import dedent from "dedent";
import { Project, QuoteKind } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import { addHandle } from "../../../../runtime/compose-handle";
import {
  ensureNamedImport,
  formatLikeSource,
} from "../../../../runtime/ts-morph-helpers";

const I18N_HANDLE = "handleWuchale";

const FAILURE_HINT = dedent`
  Wrap your exported handle with the wuchale i18n handler:

  import { sequence } from '@sveltejs/kit/hooks';
  import { runWithLocale, loadLocales } from 'wuchale/load-utils/server';
  import { getLocale } from '$locales/main.url';
  import { locales } from '$locales/data';
  import * as main from '$locales/main.loader.server.svelte.js';
  import * as js from '$locales/js.loader.server.js';

  loadLocales(main.key, main.loadCount, main.loadCatalog, locales);
  loadLocales(js.key, js.loadCount, js.loadCatalog, locales);

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

/**
 * The whole file, for a project that had no server hooks: a fresh `sv create`
 * app or a static site. `disable-i18n` deletes it again once the i18n handle
 * is all that is left.
 */
export const HOOKS_SERVER_SNIPPET = dedent`
  import type { Handle } from '@sveltejs/kit';
  import { runWithLocale, loadLocales } from 'wuchale/load-utils/server';
  import { getLocale } from '$locales/main.url';
  import { locales } from '$locales/data';
  import * as main from '$locales/main.loader.server.svelte.js';
  import * as js from '$locales/js.loader.server.js';

  loadLocales(main.key, main.loadCount, main.loadCatalog, locales);
  loadLocales(js.key, js.loadCount, js.loadCatalog, locales);

  const handleWuchale: Handle = async ({ event, resolve }) => {
    const locale = getLocale(event.url);
    return await runWithLocale(locale, () =>
      resolve(event, {
        transformPageChunk: ({ html }) => html.replace('%sveltekit.lang%', locale)
      })
    );
  };

  export const handle = handleWuchale;
`;

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
    // SvelteKit loads the first `hooks.server.*` it finds, and `.js` sorts
    // first, so a new `.ts` beside it would never run.
    if (fs.existsSync(hooksServerPath.replace(/\.ts$/, ".js"))) {
      return { status: "failed", message: FAILURE_HINT };
    }
    fs.mkdirSync(path.dirname(hooksServerPath), { recursive: true });
    fs.writeFileSync(hooksServerPath, HOOKS_SERVER_SNIPPET + "\n");
    return { status: "success", changed: true };
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

  // Composed first: an unsupported handle leaves the file untouched.
  const composed = addHandle(sourceFile, { expression: I18N_HANDLE });
  if (composed.status === "unsupported" || !composed.statement) {
    return { status: "failed", message: FAILURE_HINT };
  }
  const handleStmt = composed.statement;

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

  const startupSnippet = dedent`
    loadLocales(main.key, main.loadCount, main.loadCatalog, locales);
    loadLocales(js.key, js.loadCount, js.loadCatalog, locales);
  `;

  const i18nHandleSnippet = dedent`
    const ${I18N_HANDLE} = async ({ event, resolve }: any) => {
      const locale = getLocale(event.url);
      return await runWithLocale(locale, () =>
        resolve(event, {
          transformPageChunk: ({ html }: { html: string }) =>
            html.replace('%sveltekit.lang%', locale)
        })
      );
    };
  `;

  // Above the handle and its JSDoc, so `handleWuchale` is declared before
  // the handle reads it.
  sourceFile.insertText(
    handleStmt.getStart(true),
    `${startupSnippet}\n\n${i18nHandleSnippet}\n\n`,
  );

  formatLikeSource(sourceFile);
  sourceFile.saveSync();
  return { status: "success", changed: true };
}
