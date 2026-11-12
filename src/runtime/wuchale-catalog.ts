import fs from "node:fs";
import path from "node:path";
import type { File } from "../core/types";

/**
 * `src/locales/es.po`: the Spanish a pattern ships for the pages it writes.
 *
 * enable-i18n sets a project up with English and Spanish, and wuchale leaves
 * a message it has no translation for in English without saying so. A pattern
 * whose pages a visitor reads keeps the Spanish for them as a list of
 * entries; whichever of the two patterns is enabled second merges that list
 * into the catalog: enable-i18n for the pages already in the project, the
 * other pattern for its own pages when the project already has i18n.
 *
 * Only what is missing is filled in. A translation the developer wrote, or
 * changed, is never replaced.
 */
export const SPANISH_CATALOG = "src/locales/es.po";

export interface CatalogEntry {
  /** The message as wuchale extracts it (`Don't have an account? <0>Sign up</0>`). */
  msgid: string;
  msgstr: string;
  /** A file the message is in, relative to the project root. */
  reference: string;
}

// What wuchale writes for `es`. It rewrites the file on the next extraction,
// keeping the translations and adding the source locale's catalog.
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

const quote = (text: string) =>
  `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;

const unquote = (text: string) =>
  text.replace(/\\(.)/g, (_, char: string) => (char === "n" ? "\n" : char));

/** A `msgid` or `msgstr` value: the quoted string, and any continuation lines. */
function field(block: string, keyword: "msgid" | "msgstr"): string | null {
  const lines = block.split("\n");
  const at = lines.findIndex((line) => line.startsWith(`${keyword} "`));
  if (at === -1) return null;
  const parts = [lines[at].slice(keyword.length + 1)];
  for (let i = at + 1; i < lines.length && lines[i].startsWith('"'); i++) {
    parts.push(lines[i]);
  }
  return parts.map((part) => unquote(part.trim().slice(1, -1))).join("");
}

function entryBlock(entry: CatalogEntry): string {
  return [
    `#: ${entry.reference}`,
    `msgid ${quote(entry.msgid)}`,
    `msgstr ${quote(entry.msgstr)}`,
  ].join("\n");
}

/**
 * `source` (a `.po` catalog, or null for a project that has none yet) with
 * `entries` filled in: an entry the catalog lacks is added, one it holds
 * untranslated gets its translation, and one that is translated is left as
 * it is. Plural and context entries are not touched.
 */
export function withTranslations(
  source: string | null,
  entries: CatalogEntry[],
): { source: string; changed: boolean } {
  const blocks = (source ?? HEADER).replace(/\s+$/, "").split(/\n{2,}/);
  const byMsgid = new Map<string, number>();
  blocks.forEach((block, index) => {
    if (block.includes("\nmsgctxt ") || block.startsWith("msgctxt ")) return;
    if (block.includes("\nmsgid_plural ")) return;
    const msgid = field(block, "msgid");
    if (msgid) byMsgid.set(msgid, index);
  });

  let changed = source === null;
  for (const entry of entries) {
    const index = byMsgid.get(entry.msgid);
    if (index === undefined) {
      byMsgid.set(entry.msgid, blocks.length);
      blocks.push(entryBlock(entry));
      changed = true;
      continue;
    }
    if (field(blocks[index], "msgstr") !== "") continue;
    // The untranslated `msgstr ""` is the last field of its block.
    blocks[index] = blocks[index].replace(
      /^msgstr ""$/m,
      `msgstr ${quote(entry.msgstr)}`,
    );
    changed = true;
  }

  return {
    source: changed ? blocks.join("\n\n") + "\n" : (source ?? ""),
    changed,
  };
}

/** The entries whose file is in the project. */
export function entriesInProject(
  root: string,
  entries: CatalogEntry[],
): CatalogEntry[] {
  const present = new Map<string, boolean>();
  return entries.filter((entry) => {
    if (!present.has(entry.reference)) {
      present.set(
        entry.reference,
        fs.existsSync(path.join(root, entry.reference)),
      );
    }
    return present.get(entry.reference);
  });
}

/**
 * Whether the project's wuchale config still lists Spanish: `locales` is the
 * developer's to change, and a pattern does not bring a language back.
 */
export function hasSpanish(root: string): boolean {
  const configPath = path.join(root, "wuchale.config.js");
  if (!fs.existsSync(configPath)) return false;
  const locales = /\blocales\s*:\s*\[([^\]]*)\]/.exec(
    fs.readFileSync(configPath, "utf8"),
  );
  return locales !== null && /["']es["']/.test(locales[1]);
}

/**
 * Merge `entries` into the project's Spanish catalog. An existing catalog is
 * edited in place and returned as a modify; a project without one gets it as
 * a create, for the pattern's result to write. Both are empty when there is
 * nothing to add.
 */
export function translateCatalog(
  root: string,
  entries: CatalogEntry[],
): { create: File | null; modify: File | null } {
  const none = { create: null, modify: null };
  if (entries.length === 0) return none;

  const catalogPath = path.join(root, SPANISH_CATALOG);
  if (!fs.existsSync(catalogPath)) {
    return {
      create: {
        path: SPANISH_CATALOG,
        language: "text",
        content: withTranslations(null, entries).source,
        status: "success",
      },
      modify: null,
    };
  }

  const result = withTranslations(
    fs.readFileSync(catalogPath, "utf8"),
    entries,
  );
  if (!result.changed) return none;
  fs.writeFileSync(catalogPath, result.source);
  return {
    create: null,
    modify: {
      path: catalogPath,
      language: "text",
      content: result.source,
      status: "success",
    },
  };
}
