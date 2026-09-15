import fs from "node:fs";
import { SvelteFile } from "../../../../runtime/svelte-file";
import {
  ensureBlankLineAfterImports,
  removeImportByModuleSpecifier,
  withInMemoryScript,
} from "../../../../runtime/ts-morph-helpers";
import type { ModifyOutcome } from "../../../../core/types";

/** Take the bell (and the wrapper enable-notifications put it in) out of the header. */
export function unmodifyAppLayout(layoutPath: string): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "success", changed: false };
  }

  const original = fs.readFileSync(layoutPath, "utf8");
  if (!original.includes("NotificationsBell")) {
    return { status: "success", changed: false };
  }

  const file = SvelteFile.fromPath(layoutPath);
  file.modifyScript((source) => {
    const { source: out } = withInMemoryScript(source, (sf) => {
      removeImportByModuleSpecifier(
        sf,
        "$lib/components/notifications-bell.svelte",
      );
      ensureBlankLineAfterImports(sf);
    });
    return out;
  });

  let updated = file.toString();
  updated = updated.replace(
    /\n*[ \t]*<div class="ml-auto px-4">\s*<NotificationsBell\s*\/>\s*<\/div>[ \t]*/g,
    "",
  );
  updated = updated.replace(/[ \t]*<NotificationsBell\s*\/>[ \t]*\r?\n?/g, "");

  fs.writeFileSync(layoutPath, updated, "utf8");
  return { status: "success", changed: updated !== original };
}
