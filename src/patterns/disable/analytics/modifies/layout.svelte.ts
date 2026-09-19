import fs from "node:fs";
import { SvelteFile } from "../../../../runtime/svelte-file";
import {
  ensureBlankLineAfterImports,
  removeImportByModuleSpecifier,
  withInMemoryScript,
} from "../../../../runtime/ts-morph-helpers";
import type { ModifyOutcome } from "../../../../core/types";

const MODULE_SPECIFIER = "$lib/components/analytics/analytics.svelte";

/**
 * Takes `<Analytics />` and its import back out of the root layout. The
 * element goes with its whole line, since enable-analytics put it on one of
 * its own. A layout without it, or no layout at all, is left alone.
 */
export function unmodifyLayoutSvelte(layoutPath: string): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "success", changed: false };
  }

  const original = fs.readFileSync(layoutPath, "utf8");
  if (
    !original.includes(MODULE_SPECIFIER) &&
    !original.includes("<Analytics")
  ) {
    return { status: "success", changed: false };
  }

  const file = SvelteFile.fromPath(layoutPath);
  file.modifyScript((source) => {
    const { source: out } = withInMemoryScript(source, (sf) => {
      removeImportByModuleSpecifier(sf, MODULE_SPECIFIER);
      ensureBlankLineAfterImports(sf);
    });
    return out;
  });

  const updated = file
    .toString()
    .replace(/[ \t]*<Analytics\s*\/>[ \t]*\r?\n?/g, "");

  if (updated === original) {
    return { status: "success", changed: false };
  }
  fs.writeFileSync(layoutPath, updated, "utf8");
  return { status: "success", changed: true };
}
