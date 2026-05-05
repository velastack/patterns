import fs from "node:fs";
import dedent from "dedent";
import type { ModifyOutcome } from "../../../../core/types";

const VARIANTS = [
  {
    from: "'data-active': isActive,",
    to: "'data-active': isActive ? true : undefined,",
  },
  {
    from: '"data-active": isActive,',
    to: '"data-active": isActive ? true : undefined,',
  },
];

const NOT_FOUND_HINT = dedent`
  The shadcn-svelte sidebar component was not installed at the expected path.
  Run: vela enable auth (or install the 'sidebar' shadcn-svelte component).
`;

export function modifySidebarMenuButton(filePath: string): ModifyOutcome {
  if (!fs.existsSync(filePath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const original = fs.readFileSync(filePath, "utf8");

  if (VARIANTS.some(({ to }) => original.includes(to))) {
    return { status: "success", changed: false };
  }

  const variant = VARIANTS.find(({ from }) => original.includes(from));
  if (!variant) {
    return { status: "success", changed: false };
  }

  const updated = original.replace(variant.from, variant.to);
  fs.writeFileSync(filePath, updated, "utf8");
  return { status: "success", changed: true };
}
