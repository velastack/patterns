import { renderCard } from '#lib/server/og.js';
import { site } from '#lib/site.js';
import type { RequestHandler } from './$types';

/**
 * A share card for every page, at the page's own path: `/og/about.png` is the
 * card for `/about`, and `/og/index.png` the one for `/`.
 *
 * Prerendered pages get their card written as a file at build time; on a
 * server the rest are rendered on request.
 */
export const prerender = 'auto';

const ENTITIES: Record<string, string> = {
	'&amp;': '&',
	'&quot;': '"',
	'&#39;': "'",
	'&lt;': '<',
	'&gt;': '>'
};

/** Drops the ` | Site name` the root layout's title template adds. */
function withoutSiteName(title: string | undefined) {
	if (!title?.endsWith(site.name)) return title;
	return title.slice(0, -site.name.length).replace(/\s*[|·–—-]\s*$/, '') || title;
}

export const GET: RequestHandler = async ({ params, fetch }) => {
	// The page itself says what its card reads: whatever it set as its title
	// and description is in the meta tags it renders.
	const page = await fetch(params.path === 'index' ? '/' : `/${params.path}`);
	if (!page.ok) return new Response('Not found', { status: 404 });

	const html = await page.text();
	const meta = (property: string) =>
		html
			.match(new RegExp(`<meta property="${property}" content="([^"]*)"`))?.[1]
			?.replace(/&(amp|quot|#39|lt|gt);/g, (entity) => ENTITIES[entity]);

	const png = await renderCard({
		title: withoutSiteName(meta('og:title')) || site.name,
		description: meta('og:description'),
		siteName: site.name
	});

	return new Response(png, {
		headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' }
	});
};
