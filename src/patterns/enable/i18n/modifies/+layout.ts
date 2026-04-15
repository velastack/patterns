import fs from "node:fs";
import path from "node:path";
import dedent from "dedent";

export function ensureRootLayoutI18n(layoutPath: string) {
  if (fs.existsSync(layoutPath)) {
    const existing = fs.readFileSync(layoutPath, "utf8");
    if (existing.includes("loadLocale") || existing.includes("translateUrl")) {
      return false;
    }

    if (/\bexport\s+(const|function)\s+load\b/.test(existing)) {
      return false;
    }
  }

  const snippet = dedent`
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

  fs.mkdirSync(path.dirname(layoutPath), { recursive: true });
  fs.writeFileSync(layoutPath, snippet + "\n");
  return true;
}
