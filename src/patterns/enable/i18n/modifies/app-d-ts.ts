import fs from "node:fs";
import type { ModifyOutcome } from "../../../../core/types";

/** The member `disable-i18n` looks for to take it out again. */
export const LOCALS_MEMBER = "locale: import('#locales/data.js').Locale;";
export const LOCALS_COMMENT =
  "/** The language of this request: see src/lib/locale.ts. */";

const FAILURE_HINT = [
  "Declare the request's language on App.Locals in src/app.d.ts:",
  "",
  "interface Locals {",
  `  ${LOCALS_COMMENT}`,
  `  ${LOCALS_MEMBER}`,
  "}",
].join("\n");

/** `// interface Locals {}`, as `sv create` leaves it. */
const COMMENTED = /^([ \t]*)\/\/\s*interface Locals\s*\{\s*\}[ \t]*$/m;
const DECLARED = /^([ \t]*)interface Locals\s*\{/m;

/**
 * `event.locals.locale`, which the i18n handle sets, is declared on
 * `App.Locals`. The interface `sv create` leaves commented out is switched
 * on; one that is declared already gains the member.
 */
export function modifyAppDts(appDtsPath: string): ModifyOutcome {
  if (!fs.existsSync(appDtsPath)) {
    return { status: "not-found", message: FAILURE_HINT };
  }

  const original = fs.readFileSync(appDtsPath, "utf8");
  // Whatever its type, a `locale` on Locals is there.
  const declared = DECLARED.exec(original);
  if (declared) {
    const start = declared.index + declared[0].length;
    const end = original.indexOf("}", start);
    if (end !== -1 && /\blocale\??\s*:/.test(original.slice(start, end))) {
      return { status: "success", changed: false };
    }
  }

  const unit = /^\t/m.test(original) ? "\t" : "  ";
  const member = (indent: string) =>
    `${indent}${unit}${LOCALS_COMMENT}\n${indent}${unit}${LOCALS_MEMBER}\n`;

  let updated: string;
  const commented = COMMENTED.exec(original);
  if (declared) {
    const at = declared.index + declared[0].length;
    const rest = original.slice(at);
    updated =
      original.slice(0, at) +
      "\n" +
      member(declared[1]) +
      // `interface Locals {}` on one line: the brace moves to its own.
      (rest.startsWith("}") ? declared[1] : "") +
      rest.replace(/^[ \t]*\n/, "");
  } else if (commented) {
    const indent = commented[1];
    updated = original.replace(
      COMMENTED,
      `${indent}interface Locals {\n${member(indent)}${indent}}`,
    );
  } else {
    return { status: "failed", message: FAILURE_HINT };
  }

  fs.writeFileSync(appDtsPath, updated);
  return { status: "success", changed: true };
}
