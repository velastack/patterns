import fs from "node:fs";
import { SvelteFile } from "../../../../runtime/svelte-file";

export function modifyAppLayoutSvelte(layoutPath: string): boolean {
  if (!fs.existsSync(layoutPath)) {
    return false;
  }

  const file = SvelteFile.fromPath(layoutPath);
  if (
    !file.hasElement("AppSidebar") ||
    file.hasAttribute("AppSidebar", "teams")
  ) {
    return false;
  }

  file.appendToAttributes(
    "AppSidebar",
    " team={data.team} teams={data.teams ?? []}",
  );
  file.writeTo(layoutPath);
  return file.hasChanged();
}
