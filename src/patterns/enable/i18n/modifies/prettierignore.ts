import fs from "node:fs";
import type { ModifyOutcome } from "../../../../core/types";

/** Where wuchale writes its loaders, proxies and catalogs on every extract. */
export const LOCALES_ENTRY = "src/locales/";
export const PRETTIERIGNORE_HEADER = "# Wuchale";

/**
 * wuchale rewrites `src/locales/` in its own style on every extract, which
 * the project's `prettier --check .` would flag. A project without a
 * `.prettierignore` is left alone: without prettier there is nothing to
 * ignore, and with it the file is the project's to start.
 */
export function modifyPrettierignore(filePath: string): ModifyOutcome {
  if (!fs.existsSync(filePath)) {
    return { status: "success", changed: false };
  }

  const original = fs.readFileSync(filePath, "utf8");
  const ignored = original
    .split("\n")
    .some((line) => line.trim().replace(/^\//, "") === LOCALES_ENTRY);
  if (ignored) {
    return { status: "success", changed: false };
  }

  const needsNewline = original.length > 0 && !original.endsWith("\n");
  const separator = original.length > 0 ? "\n" : "";
  fs.writeFileSync(
    filePath,
    `${original}${needsNewline ? "\n" : ""}${separator}${PRETTIERIGNORE_HEADER}\n${LOCALES_ENTRY}\n`,
  );
  return { status: "success", changed: true };
}
