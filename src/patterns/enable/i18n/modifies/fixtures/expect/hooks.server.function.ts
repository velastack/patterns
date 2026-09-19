import { sequence } from "@sveltejs/kit/hooks";
import { runWithLocale, loadLocales } from "wuchale/load-utils/server";
import { getLocale } from "$locales/main.url";
import { locales } from "$locales/data";
import * as main from "$locales/main.loader.server.svelte.js";
import * as js from "$locales/js.loader.server.js";

/** Tags every response with the app version. */
async function handleApp({ event, resolve }) {
  const response = await resolve(event);
  response.headers.set("x-app-version", "1");
  return response;
}

loadLocales(main.key, main.loadCount, main.loadCatalog, locales);
loadLocales(js.key, js.loadCount, js.loadCatalog, locales);

const handleWuchale = async ({ event, resolve }: any) => {
  const locale = getLocale(event.url);
  return await runWithLocale(locale, () =>
    resolve(event, {
      transformPageChunk: ({ html }: { html: string }) =>
        html.replace("%sveltekit.lang%", locale),
    }),
  );
};

export const handle = sequence(handleWuchale, handleApp);
