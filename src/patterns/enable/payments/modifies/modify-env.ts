import fs from "node:fs";
import type { ModifyOutcome } from "../../../../core/types";

export interface EnvEdit {
  type: "comment" | "var";
  /** For "comment": the text after `# `. For "var": the KEY. */
  key: string;
  /** Only for "var" entries. */
  value?: string;
}

function appendEnvContent(existing: string, content: string): string {
  const withNewLine =
    !existing.length || existing.endsWith("\n") ? existing : existing + "\n";
  return withNewLine + content + "\n";
}

export function applyEnvEdits(source: string, edits: EnvEdit[]): string {
  let next = source;
  for (const edit of edits) {
    if (edit.type === "comment") {
      const commented = `# ${edit.key}`;
      if (!next.includes(commented)) {
        next = appendEnvContent(next, commented);
      }
      continue;
    }
    if (!next.includes(`${edit.key}=`)) {
      next = appendEnvContent(next, `${edit.key}=${edit.value ?? ""}`);
    }
  }
  return next;
}

export function modifyEnv(envPath: string, edits: EnvEdit[]): ModifyOutcome {
  const existing = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf8")
    : "";
  const next = applyEnvEdits(existing, edits);
  if (next === existing) {
    return { status: "success", changed: false };
  }
  fs.writeFileSync(envPath, next, "utf8");
  return { status: "success", changed: true };
}
