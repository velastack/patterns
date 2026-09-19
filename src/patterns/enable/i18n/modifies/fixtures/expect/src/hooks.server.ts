import type { Handle } from '@sveltejs/kit';
import { runWithLocale, loadLocales } from 'wuchale/load-utils/server';
import { getLocale } from '$locales/main.url';
import { locales } from '$locales/data';
import * as main from '$locales/main.loader.server.svelte.js';
import * as js from '$locales/js.loader.server.js';

loadLocales(main.key, main.loadCount, main.loadCatalog, locales);
loadLocales(js.key, js.loadCount, js.loadCatalog, locales);

const handleWuchale: Handle = async ({ event, resolve }) => {
	const locale = getLocale(event.url);
	return await runWithLocale(locale, () =>
		resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%sveltekit.lang%', locale)
		})
	);
};

export const handle = handleWuchale;
