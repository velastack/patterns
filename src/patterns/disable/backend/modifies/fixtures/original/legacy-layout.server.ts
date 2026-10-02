import { site } from '$lib/site';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	return {
		meta: locals.meta,
		canonical: new URL(url.pathname, site.url).href
	};
};
