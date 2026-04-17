import fs from "node:fs";
import dedent from "dedent";
import type { ModifyOutcome } from "../../../../core/types";

const NOT_FOUND_HINT = [
  "Create a .gitignore with the wuchale cache ignored:",
  "",
  "# Wuchale",
  "src/locales/.wuchale",
].join("\n");

export function modifyGitignore(gitignorePath: string): ModifyOutcome {
  if (!fs.existsSync(gitignorePath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const original = fs.readFileSync(gitignorePath, "utf8");
  if (original.includes("src/locales/.wuchale")) {
    return { status: "success", changed: false };
  }

  const block = dedent`
    # Wuchale
    src/locales/.wuchale
  `;

  const needsNewline = original.length > 0 && !original.endsWith("\n");
  const updated = original + (needsNewline ? "\n" : "") + "\n" + block + "\n";
  fs.writeFileSync(gitignorePath, updated);
  return { status: "success", changed: true };
}
