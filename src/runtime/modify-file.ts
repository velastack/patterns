import fs from "node:fs";
import type { File, ModifyOutcome } from "../core/types";
import { languageFromPath } from "../core/util";

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
