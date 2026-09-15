import fs from "node:fs";
import dedent from "dedent";
import { LOAD_SNIPPET } from "../../../enable/i18n/modifies/+layout";

const FAILURE_HINT = dedent`
  src/routes/+layout.ts still loads wuchale locales. Remove these from it:

  import { browser } from '$app/environment';
  import { loadLocale } from 'wuchale/load-utils';
  import { getLocale } from '$locales/main.url';
  import '$locales/main.loader.svelte';
  import '$locales/js.loader';

  and the loadLocale(...) call inside load().
`;

function normalize(source: string): string {
  return source.replace(/["']/g, "'").replace(/\s+/g, "");
}

export type RootLayoutRevert =
  | { action: "none" }
  | { action: "delete" }
  | { action: "failed"; message: string };

/**
 * enable-i18n wrote the whole file when no `+layout.ts` existed, so the
 * revert is to delete it; a file that grew other code needs a hand.
 */
export function planRootLayoutRevert(layoutPath: string): RootLayoutRevert {
  if (!fs.existsSync(layoutPath)) {
    return { action: "none" };
  }
  const existing = fs.readFileSync(layoutPath, "utf8");
  if (!existing.includes("loadLocale") && !existing.includes("$locales")) {
    return { action: "none" };
  }
  if (normalize(existing) === normalize(LOAD_SNIPPET)) {
    return { action: "delete" };
  }
  return { action: "failed", message: FAILURE_HINT };
}
