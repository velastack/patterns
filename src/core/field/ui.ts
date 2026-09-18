import { InvalidArgumentError } from "../errors";
import type { Options } from "../types";

/**
 * Which markup the form generators emit: `shadcn` is formsnap plus the
 * project's `$lib/components/ui/*`; `plain` is native elements, for projects
 * without shadcn-svelte and tailwind.
 */
export type Ui = "shadcn" | "plain";

const UIS: Ui[] = ["shadcn", "plain"];

/**
 * An explicit `input.ui` wins over the detected `features.ui`. Absent from
 * both means `shadcn`, so callers that predate the option are unchanged.
 */
export function resolveUi(options: Pick<Options, "input" | "features">): Ui {
  const ui = options.input.ui ?? options.features.ui ?? "shadcn";
  if (!UIS.includes(ui)) {
    throw new InvalidArgumentError(
      `Unknown ui "${ui}". Expected one of: ${UIS.join(", ")}.`,
    );
  }
  return ui;
}
