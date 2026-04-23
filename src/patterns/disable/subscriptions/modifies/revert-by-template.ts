import fs from "node:fs";
import type { ModifyOutcome } from "../../../../core/types";

/**
 * Rewrites a file to the given `template` if the current content still shows
 * the `enabledMarker` (meaning enable-subscriptions is applied). If the marker
 * is absent (already reverted or never applied), it's a no-op.
 *
 * Strips leading `// [!code highlight:N]` / `<!-- [!code highlight:N] -->`
 * lines so templates can be pulled from `preview-modifies/` directories which
 * use those for documentation highlighting.
 */
export function revertByTemplate(
  filePath: string,
  template: string,
  enabledMarker: string,
): ModifyOutcome {
  if (!fs.existsSync(filePath)) {
    return { status: "success", changed: false };
  }
  const current = fs.readFileSync(filePath, "utf8");
  if (!current.includes(enabledMarker)) {
    return { status: "success", changed: false };
  }
  const stripped = template
    .replace(/^[ \t]*\/\/[ \t]*\[!code highlight:\d+\][ \t]*\r?\n/gm, "")
    .replace(/^[ \t]*<!--[ \t]*\[!code highlight:\d+\][ \t]*-->[ \t]*\r?\n/gm, "");
  if (current === stripped) {
    return { status: "success", changed: false };
  }
  fs.writeFileSync(filePath, stripped, "utf8");
  return { status: "success", changed: true };
}
