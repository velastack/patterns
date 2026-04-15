import fs from "node:fs";
import dedent from "dedent";

export function modifyGitignore(gitignorePath: string) {
  if (!fs.existsSync(gitignorePath)) return false;

  const original = fs.readFileSync(gitignorePath, "utf8");
  if (original.includes("src/locales/.wuchale")) return false;

  const block = dedent`
    # Wuchale
    src/locales/.wuchale
  `;

  const needsNewline = original.length > 0 && !original.endsWith("\n");
  const updated = original + (needsNewline ? "\n" : "") + "\n" + block + "\n";
  fs.writeFileSync(gitignorePath, updated);
  return true;
}
