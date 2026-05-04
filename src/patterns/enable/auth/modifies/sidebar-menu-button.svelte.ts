import fs from "node:fs";
import dedent from "dedent";
import type { ModifyOutcome } from "../../../../core/types";

const FROM = "'data-active': isActive,";
const TO = "'data-active': isActive ? true : undefined,";

const NOT_FOUND_HINT = dedent`
  The shadcn-svelte sidebar component was not installed at the expected path.
  Run: vela enable auth (or install the 'sidebar' shadcn-svelte component).
`;

export function modifySidebarMenuButton(filePath: string): ModifyOutcome {
  if (!fs.existsSync(filePath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const original = fs.readFileSync(filePath, "utf8");

  if (original.includes(TO)) {
    return { status: "success", changed: false };
  }

  if (!original.includes(FROM)) {
    return { status: "success", changed: false };
  }

  const updated = original.replace(FROM, TO);
  fs.writeFileSync(filePath, updated, "utf8");
  return { status: "success", changed: true };
}
