import type { ModifyOutcome } from "../../../../core/types";
import { removeFromLoad } from "../../../../runtime/unmodify-load";

/** Take the unread-notifications query back out of the (app) layout's load. */
export function unmodifyLayoutServer(layoutServerPath: string): ModifyOutcome {
  return removeFromLoad(layoutServerPath, {
    variables: ["notificationsList", "notifications"],
    dependsKeys: ["app:notifications"],
    returnProps: ["notifications"],
  });
}
