import fs from "node:fs";
import type { ModifyOutcome } from "../../../../core/types";

/**
 * Overwrites a file with the given template content, guarded by an idempotency
 * marker: if the current file already contains the marker, the modify is a
 * no-op. Used for complex rewrites where surgical AST changes aren't worth it
 * (e.g. pages that are largely replaced).
 *
 * Strips leading `// [!code highlight:N]` and `<!-- [!code highlight:N] -->`
 * lines so the same content can be shared with preview-modifies, which uses
 * those comments for documentation highlighting.
 */
export function modifyByTemplate(
  filePath: string,
  template: string,
  idempotencyMarker: string,
  notFoundHint: string,
): ModifyOutcome {
  if (!fs.existsSync(filePath)) {
    return { status: "not-found", message: notFoundHint };
  }
  const current = fs.readFileSync(filePath, "utf8");
  if (current.includes(idempotencyMarker)) {
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
