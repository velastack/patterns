import fs from "node:fs";
import { SvelteFile } from "../../../../runtime/svelte-file";
import type { ModifyOutcome } from "../../../../core/types";

const FAILURE_HINT = [
  "Pass the subscription prop to <AppSidebar> in src/routes/(app)/+layout.svelte:",
  "",
  "<AppSidebar user={data.user} meta={data.meta} subscription={data.subscription} />",
].join("\n");

const NOT_FOUND_HINT = [
  "Create src/routes/(app)/+layout.svelte with an <AppSidebar /> that receives the subscription prop.",
].join("\n");

export function modifyAppLayoutSvelte(filePath: string): ModifyOutcome {
  if (!fs.existsSync(filePath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const file = SvelteFile.fromPath(filePath);
  if (!file.hasElement("AppSidebar")) {
    return { status: "failed", message: FAILURE_HINT };
  }
  if (file.hasAttribute("AppSidebar", "subscription")) {
    return { status: "success", changed: false };
  }

  const appended = file.appendToAttributes(
    "AppSidebar",
    " subscription={data.subscription}",
  );
  if (!appended) {
    return { status: "failed", message: FAILURE_HINT };
  }

  file.writeTo(filePath);
  return { status: "success", changed: file.hasChanged() };
}
