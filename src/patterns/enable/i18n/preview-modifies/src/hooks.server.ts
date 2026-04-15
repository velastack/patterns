import { env } from "$env/dynamic/private";
import { handlePocketbase } from "@velastack/pocketbase";
// [!code highlight:6]
import { sequence } from "@sveltejs/kit/hooks";
import { runWithLocale, loadLocales } from "wuchale/load-utils/server";
import { getLocale } from "$locales/main.url";
import { locales } from "$locales/data";
import * as main from "$locales/main.loader.server.svelte.js";
import * as js from "$locales/js.loader.server.js";

// [!code highlight:2]
loadLocales(main.key, main.loadIDs, main.loadCatalog, locales);
loadLocales(js.key, js.loadIDs, js.loadCatalog, locales);

// [!code highlight:9]
const handleWuchale = async ({ event, resolve }: any) => {
  const locale = getLocale(event.url);
  return await runWithLocale(locale, () =>
    resolve(event, {
      transformPageChunk: ({ html }: { html: string }) =>
        html.replace("%sveltekit.lang%", locale),
    }),
  );
};

export const handle = sequence(
  // [!code highlight:1]
  handleWuchale,
  handlePocketbase({
    pocketbaseUrl: env.POCKETBASE_URL,
    superuserEmail: env.POCKETBASE_SUPERUSER_EMAIL,
    superuserPassword: env.POCKETBASE_SUPERUSER_PASSWORD,
  }),
);
