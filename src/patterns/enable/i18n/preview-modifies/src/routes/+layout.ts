import { browser } from "$app/env";
// [!code highlight:4]
import { loadLocale } from "wuchale/load-utils";
import { getLocale } from "#locales/main.url.js";
import "#locales/main.loader.svelte.js";
import "#locales/js.loader.js";

export const load = async ({ url, data }) => {
  // [!code highlight:5]
  const locale = getLocale(url);

  if (browser) {
    await loadLocale(locale);
  }

  return data;
};
