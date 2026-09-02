import { loadFlash } from 'sveltekit-flash-message/server';
import { defineBaseMetaTags } from 'svelte-meta-tags';
import { error, redirect } from '@sveltejs/kit';
import { loadCms } from '$lib/cms';

export const load = loadFlash(async (event) => {
	const { locals, url } = event;
	const canonical = new URL(url.pathname, url.origin).href;

	const baseTags = defineBaseMetaTags({
		title: '',
		titleTemplate: `%s | ${locals.meta.appName}`,
		description: '',
		canonical,
		openGraph: {
			type: 'website',
			url: canonical,
			images: [
				{
					url: `${locals.meta.appURL}/og.jpg`,
					alt: locals.meta.appName,
					width: 1200,
					height: 630
				}
			]
		}
	});

	// [!code highlight:4]
	const { cms, notFound, gone, redirectTo } = await loadCms(event, { locale: 'en' });
	if (redirectTo) redirect(308, redirectTo);
	if (gone) error(410, 'Gone');
	if (notFound) error(404, 'Not found');

	return {
		meta: locals.meta,
		cms,
		...baseTags
	};
});
