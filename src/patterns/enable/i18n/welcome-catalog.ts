import fs from "node:fs";
import path from "node:path";
import type { File } from "../../../core/types";
import type { Ui } from "../../../core/field/ui";

const PAGE_PATH = "src/routes/+page.svelte";
const CATALOG_PATH = "src/locales/es.po";

/** `src/routes/+page.svelte` as `sv create` writes it. */
const WELCOME_PAGE = [
  "<h1>Welcome to SvelteKit</h1>",
  '<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>',
].join("\n");

interface Entry {
  reference: string;
  msgid: string;
  msgstr: string;
}

const PAGE_ENTRIES: Entry[] = [
  {
    reference: PAGE_PATH,
    msgid: "Welcome to SvelteKit",
    msgstr: "Bienvenido a SvelteKit",
  },
  {
    reference: PAGE_PATH,
    msgid: "Visit <0>svelte.dev/docs/kit</0> to read the documentation",
    msgstr: "Visita <0>svelte.dev/docs/kit</0> para leer la documentación",
  },
];

// The native <select>'s aria-label. The shadcn select has no text of its own:
// locale names come from Intl.DisplayNames.
const PLAIN_SELECT_ENTRY: Entry = {
  reference: "src/lib/components/language-select.svelte",
  msgid: "Language",
  msgstr: "Idioma",
};

// What wuchale writes for `es`. It rewrites the file on the first extraction,
// keeping these translations and adding the source locale's catalog.
const HEADER = [
  'msgid ""',
  'msgstr ""',
  '"Source-Language: en\\n"',
  '"Language: es\\n"',
  '"MIME-Version: 1.0\\n"',
  '"Content-Type: text/plain; charset=utf-8\\n"',
  '"Content-Transfer-Encoding: 8bit\\n"',
  '"Plural-Forms: nplurals=3\\n"',
  '"X-Plurals-Order: one, many, other\\n"',
].join("\n");

// Whitespace is ignored so a page prettier has rewrapped still counts.
const normalize = (source: string) => source.replace(/\s+/g, "");

/**
 * A Spanish catalog for the `sv create` welcome page, so the language select
 * visibly does something on a fresh project. Anything else in the project is
 * left for the user to translate. Null unless the page is untouched, and never
 * over an existing catalog.
 */
export function welcomePageCatalog(root: string, ui: Ui): File | null {
  if (fs.existsSync(path.join(root, CATALOG_PATH))) return null;

  const pagePath = path.join(root, PAGE_PATH);
  if (!fs.existsSync(pagePath)) return null;
  const page = fs.readFileSync(pagePath, "utf8");
  if (normalize(page) !== normalize(WELCOME_PAGE)) return null;

  const entries =
    ui === "plain" ? [...PAGE_ENTRIES, PLAIN_SELECT_ENTRY] : PAGE_ENTRIES;
  const blocks = entries.map((entry) =>
    [
      `#: ${entry.reference}`,
      `msgid "${entry.msgid}"`,
      `msgstr "${entry.msgstr}"`,
    ].join("\n"),
  );

  return {
    path: CATALOG_PATH,
    language: "text",
    content: [HEADER, ...blocks].join("\n\n") + "\n",
    status: "success",
  };
}
