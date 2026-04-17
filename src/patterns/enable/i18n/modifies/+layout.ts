import fs from "node:fs";
import path from "node:path";
import dedent from "dedent";
import type { ModifyOutcome } from "../../../../core/types";

const LOAD_SNIPPET = dedent`
  import { browser } from '$app/environment';
  import { loadLocale } from 'wuchale/load-utils';

  import { getLocale } from '$locales/main.url';
  import '$locales/main.loader.svelte';
  import '$locales/js.loader';

  export const load = async ({ url, data }) => {
    const locale = getLocale(url);

    if (browser) {
      await loadLocale(locale);
    }

    return data;
  };
`;

const FAILURE_HINT = [
  "Merge the wuchale loader into your existing load function in +layout.ts:",
  "",
  LOAD_SNIPPET,
].join("\n");

export function ensureRootLayoutI18n(layoutPath: string): ModifyOutcome {
  if (fs.existsSync(layoutPath)) {
    const existing = fs.readFileSync(layoutPath, "utf8");
    if (existing.includes("loadLocale") || existing.includes("translateUrl")) {
      return { status: "success", changed: false };
    }

    if (/\bexport\s+(const|function)\s+load\b/.test(existing)) {
      return { status: "failed", message: FAILURE_HINT };
    }
  }

  fs.mkdirSync(path.dirname(layoutPath), { recursive: true });
  fs.writeFileSync(layoutPath, LOAD_SNIPPET + "\n");
  return { status: "success", changed: true };
}
