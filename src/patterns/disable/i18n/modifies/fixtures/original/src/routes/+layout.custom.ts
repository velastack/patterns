import { browser } from "$app/env";
import { loadLocale } from "wuchale/load-utils";
import { getLocale } from "#locales/main.url.js";
import "#locales/main.loader.svelte.js";
import "#locales/js.loader.js";

export const load = async ({ url, data }) => {
  const locale = getLocale(url);
  if (browser) {
    await loadLocale(locale);
  }
  return { ...data, theme: "dark" };
};
