import fs from "node:fs";
import { SvelteFile } from "../../../../runtime/svelte-file";
import type { ModifyOutcome } from "../../../../core/types";

export function unmodifyAppLayoutSvelte(filePath: string): ModifyOutcome {
  if (!fs.existsSync(filePath)) {
    return { status: "success", changed: false };
  }

  const file = SvelteFile.fromPath(filePath);
  if (!file.hasElement("AppSidebar")) {
    return { status: "success", changed: false };
  }
  if (!file.hasAttribute("AppSidebar", "subscription")) {
    return { status: "success", changed: false };
  }

  const removed = file.removeAttribute("AppSidebar", "subscription");
  if (!removed) {
    return { status: "success", changed: false };
  }

  file.writeTo(filePath);
  return { status: "success", changed: file.hasChanged() };
}
