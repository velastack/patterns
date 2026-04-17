import fs from "node:fs";
import { SvelteFile } from "../../../../runtime/svelte-file";
import type { ModifyOutcome } from "../../../../core/types";

const FAILURE_HINT = [
  "Pass team props to <AppSidebar> in your app layout:",
  "",
  "<AppSidebar team={data.team} teams={data.teams ?? []} />",
].join("\n");

const NOT_FOUND_HINT = [
  "Create an app layout that renders <AppSidebar> with team props:",
  "",
  "<AppSidebar team={data.team} teams={data.teams ?? []} />",
].join("\n");

export function modifyAppLayoutSvelte(layoutPath: string): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const file = SvelteFile.fromPath(layoutPath);
  if (!file.hasElement("AppSidebar")) {
    return { status: "failed", message: FAILURE_HINT };
  }
  if (file.hasAttribute("AppSidebar", "teams")) {
    return { status: "success", changed: false };
  }

  file.appendToAttributes(
    "AppSidebar",
    " team={data.team} teams={data.teams ?? []}",
  );
  file.writeTo(layoutPath);
  return { status: "success", changed: file.hasChanged() };
}
