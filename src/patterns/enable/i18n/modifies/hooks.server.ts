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

/**
 * The handle's body: which language the request is in (the URL on a public
 * page, the visitor's preference elsewhere: see `src/lib/locale.ts`), and the
 * cookie that remembers the last public page opened.
 */
const HANDLE_BODY = (types: { locale: string; html: string }) => dedent`
  const urlLocale = deLocalizeDefault(event.url.pathname, locales)[1] as Locale | null;
  const localizedUrl = hasLocalizedUrl(event.url.pathname);
  const cookie${types.locale} = event.cookies.get(LOCALE_COOKIE);
  const locale = pickLocale({
    urlLocale,
    localizedUrl,
    cookie,
    acceptLanguage: event.request.headers.get('accept-language'),
    locales,
    defaultLocale
  });
  event.locals.locale = locale;

  const response${types.html ? ": Response" : ""} = await runWithLocale(locale, () =>
    resolve(event, {
      transformPageChunk: ({ html }${types.html}) => html.replace('%sveltekit.lang%', locale)
    })
  );

  // Opening a public page sets the language of the pages that have no
  // language in their URL. Only when the page itself is opened: a preload
  // (hovering a link) must not change it.
  if (localizedUrl && cookie !== locale && event.request.method === 'GET' && !event.isDataRequest) {
    try {
      response.headers.append('set-cookie', localeCookie(locale));
    } catch {
      // a response with immutable headers (a proxied file): nothing to remember
    }
  }
  return response;
`;

const indent = (text: string) =>
  text
    .split("\n")
    .map((line) => (line ? `  ${line}` : line))
    .join("\n");

const IMPORTS = dedent`
  import { runWithLocale, loadLocales } from 'wuchale/load-utils/server';
  import { deLocalizeDefault } from 'wuchale/url';
  import { locales, type Locale } from '#locales/data.js';
  import { defaultLocale, hasLocalizedUrl } from '#lib/url.js';
  import { LOCALE_COOKIE, localeCookie, pickLocale } from '#lib/locale.js';
  import * as main from '#locales/main.loader.server.svelte.js';
  import * as js from '#locales/js.loader.server.js';
`;

const STARTUP = dedent`
  loadLocales(main.key, main.loadCount, main.loadCatalog, locales);
  loadLocales(js.key, js.loadCount, js.loadCatalog, locales);
`;

/** The handle as it is added to a file whose own handle is typed loosely. */
const UNTYPED_HANDLE = [
  `const ${I18N_HANDLE} = async ({ event, resolve }: any) => {`,
  indent(
    HANDLE_BODY({ locale: ": string | undefined", html: ": { html: string }" }),
  ),
  "};",
].join("\n");

const FAILURE_HINT = [
  "Wrap your exported handle with the wuchale i18n handler:",
  "",
  "import { sequence } from '@sveltejs/kit/hooks';",
  IMPORTS,
  "",
  STARTUP,
  "",
  UNTYPED_HANDLE,
  "",
  "export const handle = sequence(handleWuchale, /* your existing handle */);",
].join("\n");

/**
 * The whole file, for a project that had no server hooks: a fresh `sv create`
 * app or a static site. `disable-i18n` deletes it again once the i18n handle
 * is all that is left.
 */
export const HOOKS_SERVER_SNIPPET = [
  "import type { Handle } from '@sveltejs/kit/hooks';",
  IMPORTS,
  "",
  STARTUP,
  "",
  `const ${I18N_HANDLE}: Handle = async ({ event, resolve }) => {`,
  indent(HANDLE_BODY({ locale: "", html: "" })),
  "};",
  "",
  `export const handle = ${I18N_HANDLE};`,
].join("\n");

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
  ensureNamedImport(sourceFile, "wuchale/url", "deLocalizeDefault");
  ensureNamedImport(sourceFile, "#locales/data.js", "locales");
  ensureNamedImport(sourceFile, "#locales/data.js", "Locale", true);
  ensureNamedImport(sourceFile, "#lib/url.js", "defaultLocale");
  ensureNamedImport(sourceFile, "#lib/url.js", "hasLocalizedUrl");
  ensureNamedImport(sourceFile, "#lib/locale.js", "LOCALE_COOKIE");
  ensureNamedImport(sourceFile, "#lib/locale.js", "localeCookie");
  ensureNamedImport(sourceFile, "#lib/locale.js", "pickLocale");
  ensureNamespaceImport(
    sourceFile,
    "#locales/main.loader.server.svelte.js",
    "main",
  );
  ensureNamespaceImport(sourceFile, "#locales/js.loader.server.js", "js");

  // Above the handle and its JSDoc, so `handleWuchale` is declared before
  // the handle reads it.
  sourceFile.insertText(
    handleStmt.getStart(true),
    `${STARTUP}\n\n${UNTYPED_HANDLE}\n\n`,
  );

  formatLikeSource(sourceFile);
  sourceFile.saveSync();
  return { status: "success", changed: true };
}
