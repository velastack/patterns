import fs from "node:fs";
import { SvelteFile } from "../../../../runtime/svelte-file";
import { addNavItemToScript } from "../../../../runtime/ts-morph-helpers";
import type { ModifyOutcome } from "../../../../core/types";

const API_KEYS_NAV_SNIPPET = [
  "import KeyRoundIcon from '@lucide/svelte/icons/key-round';",
  "",
  "// Add to your navUser array:",
  "{ title: 'API Keys', url: '/api-keys', icon: KeyRoundIcon }",
].join("\n");

const FAILURE_HINT = [
  "Add an API Keys nav item to nav-user.svelte:",
  "",
  API_KEYS_NAV_SNIPPET,
].join("\n");

const NOT_FOUND_HINT = [
  "Create nav-user.svelte with an API Keys entry:",
  "",
  API_KEYS_NAV_SNIPPET,
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
  if (navUserSnippet.includes("/api-keys")) {
    return { status: "success", changed: false };
  }

  const { newNavUserSnippet, wasAdded } = addItemToNavUser(
    navUserSnippet,
    "API Keys",
    "/api-keys",
    "KeyRoundIcon",
    "@lucide/svelte/icons/key-round",
  );

  if (!wasAdded) {
    return { status: "failed", message: FAILURE_HINT };
  }

  fs.writeFileSync(navUserPath, newNavUserSnippet, "utf8");
  return { status: "success", changed: true };
}
