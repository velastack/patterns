import fs from "node:fs";
import path from "node:path";
import type { File, Options } from "../../../core/types";
import { InvalidArgumentError } from "../../../core/errors";

/**
 * A generator writes files the developer then owns, so it never writes over
 * one that exists: the shop pages are refused while any of them is there.
 * `vela destroy shop` takes them out; a project that still has the demo page
 * an older `vela enable ecommerce` wrote removes that by hand.
 */
export function assertNoneExist(root: string, creates: File[]): void {
  const existing = creates
    .map((file) => file.path)
    .filter((file) => fs.existsSync(path.join(root, file)));
  if (existing.length === 0) return;
  throw new InvalidArgumentError(
    [
      "These files already exist, and generating the shop would write over them:",
      ...existing.map((file) => `  ${file}`),
      "",
      "Nothing was changed. Run `vela destroy shop` to remove a shop generated before, or move the files aside.",
    ].join("\n"),
  );
}

export async function generate(_options: Options) {
  // Everything the shop needs is in the base creates; this module exists so
  // the refusal above can look at the disk, which the base generator can't.
  return null;
}
