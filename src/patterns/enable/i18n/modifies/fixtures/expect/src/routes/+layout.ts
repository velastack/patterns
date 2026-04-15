import { browser } from '$app/environment';
import { loadLocale } from 'wuchale/load-utils';

import { getLocale } from '$locales/main.url';
import '$locales/main.loader.svelte';
import '$locales/js.loader';

export const load = async ({ url, data }) => {
	const locale = getLocale(url);

	if (browser) {
		await loadLocale(locale);
	}

	return data;
};
