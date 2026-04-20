import fs from "node:fs";
import type { ModifyOutcome } from "../../../../core/types";

export function unmodifyGitignore(gitignorePath: string): ModifyOutcome {
  if (!fs.existsSync(gitignorePath)) {
    return { status: "success", changed: false };
  }

  const original = fs.readFileSync(gitignorePath, "utf8");
  if (!original.includes("src/locales/.wuchale")) {
    return { status: "success", changed: false };
  }

  const lines = original.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === "# Wuchale") {
      let j = i + 1;
      let hasWuchale = false;
      while (j < lines.length && lines[j].trim() !== "") {
        if (lines[j] === "src/locales/.wuchale") {
          hasWuchale = true;
        }
        j++;
      }
      if (hasWuchale) {
        i = j;
        continue;
      }
    }
    if (line === "src/locales/.wuchale") continue;
    out.push(line);
  }

  let updated = out.join("\n");
  updated = updated.replace(/\n{3,}/g, "\n\n");

  if (updated === original) {
    return { status: "success", changed: false };
  }

  fs.writeFileSync(gitignorePath, updated);
  return { status: "success", changed: true };
}
