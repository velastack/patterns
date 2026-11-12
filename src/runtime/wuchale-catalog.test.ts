import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  SPANISH_CATALOG,
  entriesInProject,
  hasSpanish,
  translateCatalog,
  withTranslations,
  type CatalogEntry,
} from "./wuchale-catalog";

const LOGIN = "src/routes/login/+page.svelte";
const entries: CatalogEntry[] = [
  {
    reference: LOGIN,
    msgid: "Welcome back",
    msgstr: "Qué gusto verte de nuevo",
  },
  {
    reference: LOGIN,
    msgid: `Don't have an account? <0>Sign up</0>`,
    msgstr: "¿No tienes una cuenta? <0>Regístrate</0>",
  },
];

// As wuchale writes it after an extraction that found both messages.
const EXTRACTED = [
  'msgid ""',
  'msgstr ""',
  '"Language: es\\n"',
  "",
  `#: ${LOGIN}`,
  'msgid "Welcome back"',
  'msgstr ""',
  "",
  `#: ${LOGIN}`,
  'msgid "Don\'t have an account? <0>Sign up</0>"',
  'msgstr ""',
  "",
].join("\n");

describe("withTranslations", () => {
  it("fills in the messages an extraction left untranslated", () => {
    const { source, changed } = withTranslations(EXTRACTED, entries);

    expect(changed).toBe(true);
    expect(source).toContain(
      'msgid "Welcome back"\nmsgstr "Qué gusto verte de nuevo"',
    );
    expect(source).toContain(
      'msgstr "¿No tienes una cuenta? <0>Regístrate</0>"',
    );
    // The header's own empty msgstr is not a message.
    expect(source.startsWith('msgid ""\nmsgstr ""\n"Language: es\\n"')).toBe(
      true,
    );
  });

  it("never replaces a translation that is already there", () => {
    const translated = EXTRACTED.replace(
      'msgid "Welcome back"\nmsgstr ""',
      'msgid "Welcome back"\nmsgstr "Hola otra vez"',
    );
    const { source } = withTranslations(translated, entries);

    expect(source).toContain('msgstr "Hola otra vez"');
    expect(source).not.toContain("Qué gusto");
  });

  it("adds the messages the catalog has not seen, for the next extraction to place", () => {
    const { source, changed } = withTranslations(
      'msgid ""\nmsgstr ""\n"Language: es\\n"\n',
      entries,
    );

    expect(changed).toBe(true);
    expect(source).toContain(
      `#: ${LOGIN}\nmsgid "Welcome back"\nmsgstr "Qué gusto verte de nuevo"`,
    );
  });

  it("starts a catalog for a project that has none", () => {
    const { source, changed } = withTranslations(null, entries);

    expect(changed).toBe(true);
    expect(source).toContain('"Language: es\\n"');
    expect(source).toContain('msgid "Welcome back"');
  });

  it("is settled once every message is in", () => {
    const once = withTranslations(EXTRACTED, entries).source;
    expect(withTranslations(once, entries)).toEqual({
      source: once,
      changed: false,
    });
  });

  it("escapes quotes the way a catalog stores them", () => {
    const { source } = withTranslations(null, [
      { reference: LOGIN, msgid: 'Say "hi"', msgstr: 'Di "hola"' },
    ]);
    expect(source).toContain('msgid "Say \\"hi\\""\nmsgstr "Di \\"hola\\""');
    // And reads them back: a second pass finds the entry it wrote.
    expect(
      withTranslations(source, [
        { reference: LOGIN, msgid: 'Say "hi"', msgstr: "x" },
      ]).changed,
    ).toBe(false);
  });
});

describe("translateCatalog", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-"));
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("returns a create for a project without a catalog, and writes nothing", () => {
    const { create, modify } = translateCatalog(root, entries);

    expect(modify).toBeNull();
    expect(create?.path).toBe(SPANISH_CATALOG);
    expect(fs.existsSync(path.join(root, SPANISH_CATALOG))).toBe(false);
  });

  it("edits an existing catalog in place", () => {
    const file = path.join(root, SPANISH_CATALOG);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, EXTRACTED);

    const { create, modify } = translateCatalog(root, entries);

    expect(create).toBeNull();
    expect(modify?.path).toBe(file);
    expect(fs.readFileSync(file, "utf8")).toContain("Qué gusto verte de nuevo");
    expect(translateCatalog(root, entries)).toEqual({
      create: null,
      modify: null,
    });
  });

  it("only takes the entries whose page is in the project", () => {
    expect(entriesInProject(root, entries)).toEqual([]);
    fs.mkdirSync(path.join(root, path.dirname(LOGIN)), { recursive: true });
    fs.writeFileSync(path.join(root, LOGIN), "");
    expect(entriesInProject(root, entries)).toEqual(entries);
  });

  it("does not bring Spanish back to a project that dropped it", () => {
    const config = path.join(root, "wuchale.config.js");
    expect(hasSpanish(root)).toBe(false);
    fs.writeFileSync(config, 'export default { locales: ["en", "es"] };');
    expect(hasSpanish(root)).toBe(true);
    fs.writeFileSync(config, "export default { locales: ['en', 'fr'] };");
    expect(hasSpanish(root)).toBe(false);
  });
});
