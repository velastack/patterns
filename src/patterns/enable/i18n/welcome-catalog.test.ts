import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dedent from "dedent";
import { welcomePageCatalog } from "./welcome-catalog";

const SV_PAGE = dedent`
  <h1>Welcome to SvelteKit</h1>
  <p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>
`;

// What `wuchale` extracts from a bare `sv create` with enable-i18n applied,
// translated, less the url entry wuchale adds for itself.
const PLAIN_CATALOG = String.raw`msgid ""
msgstr ""
"Source-Language: en\n"
"Language: es\n"
"MIME-Version: 1.0\n"
"Content-Type: text/plain; charset=utf-8\n"
"Content-Transfer-Encoding: 8bit\n"
"Plural-Forms: nplurals=3\n"
"X-Plurals-Order: one, many, other\n"

#: src/routes/+page.svelte
msgid "Welcome to SvelteKit"
msgstr "Bienvenido a SvelteKit"

#: src/routes/+page.svelte
msgid "Visit <0>svelte.dev/docs/kit</0> to read the documentation"
msgstr "Visita <0>svelte.dev/docs/kit</0> para leer la documentación"

#: src/lib/components/language-select.svelte
msgid "Language"
msgstr "Idioma"
`;

describe("welcome page catalog", () => {
  let root: string;

  const writePage = (content: string) => {
    fs.mkdirSync(path.join(root, "src", "routes"), { recursive: true });
    fs.writeFileSync(path.join(root, "src", "routes", "+page.svelte"), content);
  };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "welcome-catalog-"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("translates the sv create page and the native select", () => {
    writePage(SV_PAGE + "\n");

    const catalog = welcomePageCatalog(root, "plain");

    expect(catalog?.path).toBe("src/locales/es.po");
    expect(catalog?.content).toBe(PLAIN_CATALOG);
  });

  it("leaves out the select label with shadcn, which has none", () => {
    writePage(SV_PAGE);

    const content = welcomePageCatalog(root, "shadcn")!.content;

    expect(content).toContain('msgstr "Bienvenido a SvelteKit"');
    expect(content).not.toContain('msgid "Language"');
  });

  it("still recognises the page after prettier rewraps it", () => {
    writePage(
      [
        "<h1>Welcome to SvelteKit</h1>",
        "<p>",
        '\tVisit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the',
        "\tdocumentation",
        "</p>",
      ].join("\n"),
    );

    expect(welcomePageCatalog(root, "plain")).not.toBeNull();
  });

  it("does nothing once the page has been edited", () => {
    writePage("<h1>My app</h1>\n");

    expect(welcomePageCatalog(root, "plain")).toBeNull();
  });

  it("does nothing without a root page", () => {
    expect(welcomePageCatalog(root, "plain")).toBeNull();
  });

  it("never replaces an existing catalog", () => {
    writePage(SV_PAGE);
    fs.mkdirSync(path.join(root, "src", "locales"));
    fs.writeFileSync(path.join(root, "src", "locales", "es.po"), "");

    expect(welcomePageCatalog(root, "plain")).toBeNull();
  });
});
