import { handleStatic } from '@velastack/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { runWithLocale, loadLocales } from 'wuchale/load-utils/server';
import { getLocale } from '$locales/main.url';
import { locales } from '$locales/data';
import * as main from '$locales/main.loader.server.svelte.js';
import * as js from '$locales/js.loader.server.js';

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

/**
 * The footer links to `/privacy` and `/terms` before they exist. In dev, this
 * answers a 404 there with the `vela legal` command that creates the page
 * instead of a bare "page not found".
 *
 * A static build has no server, so nothing here reaches the deployed site.
 */
export const handle = sequence(handleWuchale, handleStatic());
