// [!code highlight:1]
import { sequence, type ServerInit } from "@sveltejs/kit/hooks";
import {
  POCKETBASE_URL,
  POCKETBASE_SUPERUSER_EMAIL,
  POCKETBASE_SUPERUSER_PASSWORD,
} from "$app/env/private";
import { handlePocketbase } from "@velastack/pocketbase";
import { startWorker } from "#lib/server/workflows.js";
// [!code highlight:5]
import { runWithLocale, loadLocales } from "wuchale/load-utils/server";
import { getLocale } from "#locales/main.url.js";
import { locales } from "#locales/data.js";
import * as main from "#locales/main.loader.server.svelte.js";
import * as js from "#locales/js.loader.server.js";

// [!code highlight:2]
loadLocales(main.key, main.loadCount, main.loadCatalog, locales);
loadLocales(js.key, js.loadCount, js.loadCatalog, locales);

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

// [!code highlight:2]
export const handle = sequence(
  handleWuchale,
  handlePocketbase({
    pocketbaseUrl: POCKETBASE_URL,
    superuserEmail: POCKETBASE_SUPERUSER_EMAIL,
    superuserPassword: POCKETBASE_SUPERUSER_PASSWORD,
  }),
  // [!code highlight:1]
);

// Runs once when the server starts: executes the workflows in src/lib/workflows.
export const init: ServerInit = () => startWorker();
