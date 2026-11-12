import {
  POCKETBASE_URL,
  POCKETBASE_SUPERUSER_EMAIL,
  POCKETBASE_SUPERUSER_PASSWORD,
} from "$app/env/private";
import { handlePocketbase } from "@velastack/pocketbase";
import { runWithLocale, loadLocales } from 'wuchale/load-utils/server';
import { deLocalizeDefault } from 'wuchale/url';
import { locales, type Locale } from '#locales/data.js';
import { defaultLocale, hasLocalizedUrl } from '#lib/url.js';
import { LOCALE_COOKIE, localeCookie, pickLocale } from '#lib/locale.js';
import * as main from '#locales/main.loader.server.svelte.js';
import * as js from '#locales/js.loader.server.js';

export const getPocketbase = () =>
  handlePocketbase({
    pocketbaseUrl: POCKETBASE_URL,
    superuserEmail: POCKETBASE_SUPERUSER_EMAIL,
    superuserPassword: POCKETBASE_SUPERUSER_PASSWORD,
  });

loadLocales(main.key, main.loadCount, main.loadCatalog, locales);
loadLocales(js.key, js.loadCount, js.loadCatalog, locales);

const handleWuchale = async ({ event, resolve }: any) => {
  const urlLocale = deLocalizeDefault(event.url.pathname, locales)[1] as Locale | null;
  const localizedUrl = hasLocalizedUrl(event.url.pathname);
  const cookie: string | undefined = event.cookies.get(LOCALE_COOKIE);
  const locale = pickLocale({
    urlLocale,
    localizedUrl,
    cookie,
    acceptLanguage: event.request.headers.get('accept-language'),
    locales,
    defaultLocale
  });
  event.locals.locale = locale;

  const response: Response = await runWithLocale(locale, () =>
    resolve(event, {
      transformPageChunk: ({ html }: { html: string }) => html.replace('%sveltekit.lang%', locale)
    })
  );

  // Opening a public page sets the language of the pages that have no
  // language in their URL. Only when the page itself is opened: a preload
  // (hovering a link) must not change it.
  if (localizedUrl && cookie !== locale && event.request.method === 'GET' && !event.isDataRequest) {
    try {
      response.headers.append('set-cookie', localeCookie(locale));
    } catch {
      // a response with immutable headers (a proxied file): nothing to remember
    }
  }
  return response;
};

export const handle = handleWuchale;
