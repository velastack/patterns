import fs from "node:fs";
import type { ModifyOutcome } from "../core/types";

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

/**
 * Remove lines matching the given edits from env source. Var edits remove the
 * exact `KEY=...` line (anchored, so `FOO` does not match `FOO_BAR`). Comment
 * edits remove the `# key` line only when it has become orphaned — i.e. the
 * next non-blank line is another comment, another orphaned block, or EOF.
 */
export function removeEnvEdits(source: string, edits: EnvEdit[]): string {
  const lines = source.split("\n");
  const keep: boolean[] = lines.map(() => true);

  for (const edit of edits) {
    if (edit.type !== "var") continue;
    for (let i = 0; i < lines.length; i++) {
      if (!keep[i]) continue;
      const line = lines[i];
      if (
        line === `${edit.key}=${edit.value ?? ""}` ||
        line.startsWith(`${edit.key}=`)
      ) {
        keep[i] = false;
      }
    }
  }

  for (const edit of edits) {
    if (edit.type !== "comment") continue;
    const target = `# ${edit.key}`;
    for (let i = 0; i < lines.length; i++) {
      if (!keep[i] || lines[i] !== target) continue;
      let j = i + 1;
      while (j < lines.length && (!keep[j] || lines[j].trim() === "")) j++;
      const nextIsComment = j >= lines.length || lines[j].startsWith("#");
      if (nextIsComment) {
        keep[i] = false;
      }
    }
  }

  const result: string[] = [];
  let lastWasBlank = false;
  for (let i = 0; i < lines.length; i++) {
    if (!keep[i]) continue;
    const isBlank = lines[i].trim() === "";
    if (isBlank && lastWasBlank) continue;
    result.push(lines[i]);
    lastWasBlank = isBlank;
  }

  while (result.length > 0 && result[result.length - 1].trim() === "") {
    result.pop();
  }

  return result.length === 0 ? "" : result.join("\n") + "\n";
}

export function modifyEnvRemove(
  envPath: string,
  edits: EnvEdit[],
): ModifyOutcome {
  const existing = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf8")
    : "";
  const next = removeEnvEdits(existing, edits);
  if (next === existing) {
    return { status: "success", changed: false };
  }
  fs.writeFileSync(envPath, next, "utf8");
  return { status: "success", changed: true };
}
