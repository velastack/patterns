import { env } from "$env/dynamic/private";
import { handlePocketbase } from "@svsh/pocketbase";
import { sequence } from "@sveltejs/kit/hooks";
import { runWithLocale, loadLocales } from "wuchale/load-utils/server";
import { getLocale } from "$locales/main.url";
import { locales } from "$locales/data";
import * as main from "$locales/main.loader.server.svelte.js";
import * as js from "$locales/js.loader.server.js";

loadLocales(main.key, main.loadIDs, main.loadCatalog, locales);
loadLocales(js.key, js.loadIDs, js.loadCatalog, locales);

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
  handleWuchale,
  handlePocketbase({
    pocketbaseUrl: env.POCKETBASE_URL,
    superuserEmail: env.POCKETBASE_SUPERUSER_EMAIL,
    superuserPassword: env.POCKETBASE_SUPERUSER_PASSWORD,
  }),
);
