import fs from "node:fs";
import path from "node:path";
import type { File, ModifyOutcome } from "../core/types";
import { languageFromPath } from "../core/util";
import { toDeleteEntry } from "../patterns/destroy/shared";
import { isEffectivelyEmpty, withInMemoryScript } from "./ts-morph-helpers";

export function modifyOutcomeToFile(
  filePath: string,
  outcome: ModifyOutcome,
): File | null {
  const language = languageFromPath(filePath);

  if (outcome.status === "success") {
    if (!outcome.changed) return null;
    return {
      path: filePath,
      language,
      content: fs.readFileSync(filePath, "utf8"),
      status: "success",
    };
  }

  const content =
    outcome.status === "failed" && fs.existsSync(filePath)
      ? fs.readFileSync(filePath, "utf8")
      : "";

  return {
    path: filePath,
    language,
    content,
    status: outcome.status,
    message: outcome.message,
  };
}

/**
 * `modifyOutcomeToFile` for a revert that may have taken out everything the
 * file held: a script left with no statements, only comments and whitespace,
 * is reported as a delete. For hooks files a pattern created, or that ended
 * up holding nothing but what patterns put there.
 */
export function revertOutcomeToFile(
  filePath: string,
  outcome: ModifyOutcome,
): { modify: File | null; delete: File | null } {
  if (
    outcome.status === "success" &&
    outcome.changed &&
    fs.existsSync(filePath) &&
    withInMemoryScript(fs.readFileSync(filePath, "utf8"), isEffectivelyEmpty)
      .result
  ) {
    return { modify: null, delete: toDeleteEntry(filePath) };
  }
  return { modify: modifyOutcomeToFile(filePath, outcome), delete: null };
}

/**
 * Drop any create that already exists on disk.
 *
 * `writeResult` overwrites an existing create whose content differs and
 * reports it as a modify, which would mean a re-run silently resetting a
 * developer's edits, or a create clobbering a file other patterns have
 * already written to. The file is theirs once it exists; a pattern that has
 * something to add to it does so with a modifier.
 */
export function keepMissing(creates: File[], root: string): File[] {
  return creates.filter((file) => !fs.existsSync(path.join(root, file.path)));
}
