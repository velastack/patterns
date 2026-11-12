import fs from "node:fs";
import type { ModifyOutcome } from "../../../../core/types";
import {
  LOCALES_ENTRY,
  PRETTIERIGNORE_HEADER,
} from "../../../enable/i18n/modifies/prettierignore";

/** Removes the block enable-i18n appended; an entry the project wrote itself stays. */
export function unmodifyPrettierignore(filePath: string): ModifyOutcome {
  if (!fs.existsSync(filePath)) {
    return { status: "success", changed: false };
  }

  const original = fs.readFileSync(filePath, "utf8");
  const lines = original.split("\n");
  const at = lines.findIndex(
    (line, index) =>
      line === PRETTIERIGNORE_HEADER && lines[index + 1] === LOCALES_ENTRY,
  );
  if (at === -1) {
    return { status: "success", changed: false };
  }

  lines.splice(at, 2);
  // The blank line that set the block apart goes with it.
  if (at > 0 && lines[at - 1] === "" && (lines[at] ?? "") === "") {
    lines.splice(at - 1, 1);
  }
  fs.writeFileSync(filePath, lines.join("\n"));
  return { status: "success", changed: true };
}
