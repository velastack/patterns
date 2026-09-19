import { loadFlash } from 'sveltekit-flash-message/server';
import { defineBaseMetaTags } from 'svelte-meta-tags';
import { site } from '$lib/site';
import { error, redirect } from '@sveltejs/kit';
import { loadCms } from '$lib/cms';

export const load = loadFlash(async (event) => {
	const { url } = event;
	// Built from `site.url`, not `url.origin`: every deployment and every
	// prerendered page (where the origin is SvelteKit's placeholder host) should
	// point at the one address the site is published under.
	const canonical = new URL(url.pathname, site.url).href;

	const baseTags = defineBaseMetaTags({
		title: '',
		titleTemplate: `%s | ${site.name}`,
		description: '',
		canonical,
		openGraph: {
			type: 'website',
			url: canonical,
			images: [
				{
					url: `${site.url}/og.jpg`,
					alt: site.name,
					width: 1200,
					height: 630
				}
			]
		}
	});

	const { cms, notFound, gone, redirectTo } = await loadCms(event, { locale: 'en' });
	if (redirectTo) redirect(308, redirectTo);
	if (gone) error(410, 'Gone');
	if (notFound) error(404, 'Not found');

	return {
		cms,
		...baseTags
	};
});
