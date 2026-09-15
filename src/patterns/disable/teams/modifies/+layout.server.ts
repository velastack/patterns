import type { ModifyOutcome } from "../../../../core/types";
import { removeFromLoad } from "../../../../runtime/unmodify-load";

/** Take the team loader back out of the (app) layout's load. */
export function unmodifyLayoutServer(layoutServerPath: string): ModifyOutcome {
  return removeFromLoad(layoutServerPath, {
    variables: ["team", "teams"],
    dependsKeys: ["app:team"],
    returnProps: ["team", "teams"],
  });
}
