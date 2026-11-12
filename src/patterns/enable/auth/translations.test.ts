import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { AUTH_TRANSLATIONS } from "./translations";

/** Everything a pattern can write: templates, variants and modifier snippets. */
function patternSources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return patternSources(full);
    if (/translations(\.test)?\.ts$/.test(entry.name)) return [];
    return [fs.readFileSync(full, "utf8")];
  });
}

const PLACEHOLDER = /<\/?\d+\/?>|\{\d+\}/g;
const placeholders = (text: string) => (text.match(PLACEHOLDER) ?? []).sort();

describe("enable auth Spanish translations", () => {
  // The two auth patterns write the same pages; the translations cover both.
  const patterns = [__dirname, path.join(__dirname, "..", "auth-remote")];
  // wuchale extracts the text, not the markup's entities.
  const sources = patterns
    .flatMap(patternSources)
    .join("\n")
    .replace(/&apos;/g, "'");

  it("has one translation per message", () => {
    const msgids = AUTH_TRANSLATIONS.map((entry) => entry.msgid);
    expect(msgids.filter((id, i) => msgids.indexOf(id) !== i)).toEqual([]);
  });

  // An entry is merged only when its file is in the project.
  it("files every message under a page the pattern writes", () => {
    const missing = AUTH_TRANSLATIONS.map((entry) => entry.reference).filter(
      (reference) =>
        !patterns.some((pattern) =>
          fs.existsSync(path.join(pattern, "creates", reference)),
        ),
    );
    expect([...new Set(missing)]).toEqual([]);
  });

  it("files only remote-function messages under a file one pattern lacks", () => {
    const particular = AUTH_TRANSLATIONS.map((entry) => entry.reference).filter(
      (reference) =>
        !patterns.every((pattern) =>
          fs.existsSync(path.join(pattern, "creates", reference)),
        ),
    );
    expect(
      [...new Set(particular)].filter(
        (reference) => !reference.endsWith("form.remote.ts"),
      ),
    ).toEqual([]);
  });

  // A message is matched by its text, so a template that is reworded leaves
  // its translation behind without anything failing in the project.
  it("translates text the templates still contain", () => {
    const stale = AUTH_TRANSLATIONS.filter((entry) =>
      entry.msgid
        .split(PLACEHOLDER)
        .map((fragment) => fragment.trim())
        .filter((fragment) => fragment.length > 1)
        .some((fragment) => !sources.includes(fragment)),
    ).map((entry) => entry.msgid);
    expect(stale).toEqual([]);
  });

  it("keeps each message's placeholders", () => {
    for (const entry of AUTH_TRANSLATIONS) {
      expect(placeholders(entry.msgstr), entry.msgid).toEqual(
        placeholders(entry.msgid),
      );
    }
  });
});
