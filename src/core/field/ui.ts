import { InvalidArgumentError } from "../errors";
import type { Options } from "../types";

/**
 * Which markup the form generators emit: `shadcn` is formsnap plus the
 * project's `$lib/components/ui/*`; `plain` is native elements, for projects
 * without shadcn-svelte and tailwind.
 */
export type Ui = "shadcn" | "plain";

const UIS: Ui[] = ["shadcn", "plain"];

/** Absent means `shadcn`, so callers that predate the option are unchanged. */
export function resolveUi(input: Options["input"]): Ui {
  const ui = input.ui ?? "shadcn";
  if (!UIS.includes(ui)) {
    throw new InvalidArgumentError(
      `Unknown ui "${ui}". Expected one of: ${UIS.join(", ")}.`,
    );
  }
  return ui;
}
