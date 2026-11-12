import { browser } from '$app/env';
import { loadLocale } from 'wuchale/load-utils';

import { getLocale } from '#locales/main.url.js';
import { hasLocalizedUrl } from '#lib/url.js';
import '#locales/main.loader.svelte.js';
import '#locales/js.loader.js';

export const load = async ({ url, data }) => {
  // A public page's language is in its URL. The others follow the visitor's
  // preference, which only the server knows: see src/lib/locale.ts.
  const locale = hasLocalizedUrl(url.pathname) ? getLocale(url) : data.locale;

  if (browser) {
    await loadLocale(locale);
  }

  return { ...data, locale };
};
