import fs from "node:fs";
import { SvelteFile } from "../../../../runtime/svelte-file";
import { addNavItemToScript } from "../../../../runtime/ts-morph-helpers";
import type { ModifyOutcome } from "../../../../core/types";

const TEAMS_NAV_SNIPPET = [
  "import UsersIcon from '@lucide/svelte/icons/users';",
  "",
  "// Add to your navUser array:",
  "{ title: 'Teams', url: '/teams', icon: UsersIcon }",
].join("\n");

const FAILURE_HINT = [
  "Add a Teams nav item to nav-user.svelte:",
  "",
  TEAMS_NAV_SNIPPET,
].join("\n");

const NOT_FOUND_HINT = [
  "Create nav-user.svelte with a Teams entry:",
  "",
  TEAMS_NAV_SNIPPET,
].join("\n");

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

export function modifyNavUser(navUserPath: string): ModifyOutcome {
  if (!fs.existsSync(navUserPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const navUserSnippet = fs.readFileSync(navUserPath, "utf8");
  if (navUserSnippet.includes("/teams")) {
    return { status: "success", changed: false };
  }

  const { newNavUserSnippet, wasAdded } = addItemToNavUser(
    navUserSnippet,
    "Teams",
    "/teams",
    "UsersIcon",
    "@lucide/svelte/icons/users",
  );

  if (!wasAdded) {
    return { status: "failed", message: FAILURE_HINT };
  }

  fs.writeFileSync(navUserPath, newNavUserSnippet, "utf8");
  return { status: "success", changed: true };
}
