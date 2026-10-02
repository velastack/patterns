import { sequence } from '@sveltejs/kit/hooks';
import { runWithLocale, loadLocales } from 'wuchale/load-utils/server';
import { getLocale } from '#locales/main.url.js';
import { locales } from '#locales/data.js';
import * as main from '#locales/main.loader.server.svelte.js';
import * as js from '#locales/js.loader.server.js';
import {
	POCKETBASE_URL,
	POCKETBASE_SUPERUSER_EMAIL,
	POCKETBASE_SUPERUSER_PASSWORD
} from '$app/env/private';
import { handlePocketbase } from '@velastack/pocketbase';

loadLocales(main.key, main.loadCount, main.loadCatalog, locales);
loadLocales(js.key, js.loadCount, js.loadCatalog, locales);

const handleWuchale = async ({ event, resolve }: any) => {
	const locale = getLocale(event.url);
	return await runWithLocale(locale, () =>
		resolve(event, {
			transformPageChunk: ({ html }: { html: string }) => html.replace('%sveltekit.lang%', locale)
		})
	);
};

export const handle = sequence(
	handleWuchale,
	handlePocketbase({
		pocketbaseUrl: POCKETBASE_URL,
		superuserEmail: POCKETBASE_SUPERUSER_EMAIL,
		superuserPassword: POCKETBASE_SUPERUSER_PASSWORD
	})
);
