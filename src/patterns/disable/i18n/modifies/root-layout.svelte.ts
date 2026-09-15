import fs from "node:fs";
import { SvelteFile } from "../../../../runtime/svelte-file";
import {
  ensureBlankLineAfterImports,
  removeImportByModuleSpecifier,
  withInMemoryScript,
} from "../../../../runtime/ts-morph-helpers";
import type { ModifyOutcome } from "../../../../core/types";

/** Take the language select (and the nav item enable-i18n wrapped it in) back out. */
export function unmodifyRootLayoutLanguageSelect(
  layoutPath: string,
): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "success", changed: false };
  }

  const original = fs.readFileSync(layoutPath, "utf8");
  if (!original.includes("LanguageSelect")) {
    return { status: "success", changed: false };
  }

  const file = SvelteFile.fromPath(layoutPath);
  file.modifyScript((source) => {
    const { source: out } = withInMemoryScript(source, (sf) => {
      removeImportByModuleSpecifier(
        sf,
        "$lib/components/language-select.svelte",
      );
      ensureBlankLineAfterImports(sf);
    });
    return out;
  });

  let updated = file.toString();
  updated = updated.replace(
    /[ \t]*<Navbar\.Item>\s*<LanguageSelect\s*\/>\s*<\/Navbar\.Item>[ \t]*\r?\n?/g,
    "",
  );
  updated = updated.replace(/[ \t]*<LanguageSelect\s*\/>[ \t]*\r?\n?/g, "");

  fs.writeFileSync(layoutPath, updated, "utf8");
  return { status: "success", changed: updated !== original };
}
