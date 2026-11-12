import fs from "node:fs";
import type { ModifyOutcome } from "../../../../core/types";
import {
  LOCALS_COMMENT,
  LOCALS_MEMBER,
} from "../../../enable/i18n/modifies/app-d-ts";

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const MEMBER = new RegExp(
  `(?:^[ \\t]*${escape(LOCALS_COMMENT)}[ \\t]*\\r?\\n)?^[ \\t]*${escape(LOCALS_MEMBER)}[ \\t]*\\r?\\n`,
  "m",
);

/** An `interface Locals` left with nothing in it. */
const EMPTY_LOCALS = /^([ \t]*)interface Locals\s*\{\s*\}/m;

/**
 * Undo `modifyAppDts`: `App.Locals` loses `locale`, and an interface left
 * empty goes back to the comment `sv create` writes.
 */
export function unmodifyAppDts(appDtsPath: string): ModifyOutcome {
  if (!fs.existsSync(appDtsPath)) {
    return { status: "success", changed: false };
  }

  const original = fs.readFileSync(appDtsPath, "utf8");
  if (!MEMBER.test(original)) {
    return { status: "success", changed: false };
  }

  const updated = original
    .replace(MEMBER, "")
    .replace(EMPTY_LOCALS, "$1// interface Locals {}");
  fs.writeFileSync(appDtsPath, updated, "utf8");
  return { status: "success", changed: true };
}
