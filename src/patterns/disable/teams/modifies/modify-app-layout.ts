import fs from "node:fs";
import { SvelteFile } from "../../../../runtime/svelte-file";
import type { ModifyOutcome } from "../../../../core/types";

/** Drop the team props enable-teams passed to <AppSidebar>. */
export function unmodifyAppLayoutSvelte(layoutPath: string): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "success", changed: false };
  }

  const file = SvelteFile.fromPath(layoutPath);
  if (!file.hasElement("AppSidebar")) {
    return { status: "success", changed: false };
  }

  file.removeAttribute("AppSidebar", "team");
  file.removeAttribute("AppSidebar", "teams");
  if (!file.hasChanged()) {
    return { status: "success", changed: false };
  }

  file.writeTo(layoutPath);
  return { status: "success", changed: true };
}
