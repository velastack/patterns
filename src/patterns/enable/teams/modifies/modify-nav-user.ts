import fs from "node:fs";
import { SvelteFile } from "../../../../runtime/svelte-file";
import { addNavItemToScript } from "../../../../runtime/ts-morph-helpers";

export function addItemToNavUser(
  navUserSnippet: string,
  title: string,
  url: string,
  icon: string,
  iconImportPath: string,
): { newNavUserSnippet: string; wasAdded: boolean } {
  const file = new SvelteFile(navUserSnippet);
  let wasAdded = false;

  const tryAdd = (run: (fn: (s: string) => string) => boolean) => {
    if (wasAdded) return;
    run((source) => {
      const result = addNavItemToScript(
        source,
        title,
        url,
        icon,
        iconImportPath,
      );
      if (result.wasAdded) wasAdded = true;
      return result.source;
    });
  };

  tryAdd((fn) => file.modifyModuleScript(fn));
  if (!wasAdded) tryAdd((fn) => file.modifyScript(fn));

  return { newNavUserSnippet: file.toString(), wasAdded };
}

export function modifyNavUser(navUserPath: string): boolean {
  if (!fs.existsSync(navUserPath)) return false;

  const navUserSnippet = fs.readFileSync(navUserPath, "utf8");
  const { newNavUserSnippet, wasAdded } = addItemToNavUser(
    navUserSnippet,
    "Teams",
    "/teams",
    "UsersIcon",
    "@lucide/svelte/icons/users",
  );

  if (wasAdded) {
    fs.writeFileSync(navUserPath, newNavUserSnippet, "utf8");
  }

  return wasAdded;
}
