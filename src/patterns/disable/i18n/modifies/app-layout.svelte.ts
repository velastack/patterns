import fs from "node:fs";
import { SvelteFile } from "../../../../runtime/svelte-file";
import {
  ensureBlankLineAfterImports,
  removeImportByModuleSpecifier,
  withInMemoryScript,
} from "../../../../runtime/ts-morph-helpers";
import type { ModifyOutcome } from "../../../../core/types";
import { libModule } from "../../../../runtime/lib-specifier";
import { APP_LANGUAGE_SELECT } from "../../../enable/i18n/modifies/app-layout.svelte";

/** Take the language select back out of the signed-in layout's header. */
export function unmodifyAppLayoutLanguageSelect(
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
        libModule("components/language-select.svelte"),
      );
      ensureBlankLineAfterImports(sf);
    });
    return out;
  });

  const updated = file
    .toString()
    .replace(APP_LANGUAGE_SELECT, "")
    // Moved out of the wrapper by hand: the component alone still goes.
    .replace(/[ \t]*<LanguageSelect\s*\/>[ \t]*\r?\n?/g, "");

  fs.writeFileSync(layoutPath, updated, "utf8");
  return { status: "success", changed: updated !== original };
}
