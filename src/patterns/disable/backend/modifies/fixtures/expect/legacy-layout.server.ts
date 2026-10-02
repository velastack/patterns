import { site } from '$lib/site';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ url }) => {
	return {
		meta: { appName: site.name, appURL: site.url },
		canonical: new URL(url.pathname, site.url).href
	};
};
