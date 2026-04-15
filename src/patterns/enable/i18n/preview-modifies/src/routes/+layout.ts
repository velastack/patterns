import { browser } from "$app/environment";
// [!code highlight:4]
import { loadLocale } from "wuchale/load-utils";
import { getLocale } from "$locales/main.url";
import "$locales/main.loader.svelte";
import "$locales/js.loader";

export const load = async ({ url, data }) => {
  // [!code highlight:5]
  const locale = getLocale(url);

  if (browser) {
    await loadLocale(locale);
  }

  return data;
};
