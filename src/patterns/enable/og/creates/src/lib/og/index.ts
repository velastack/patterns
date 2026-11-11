import type { MetaTagsProps } from 'svelte-meta-tags';
import { site } from '#lib/site.js';

/** Where a page's share card is served: `/` is `/og/index.png`, `/about` is `/og/about.png`. */
export function cardPath(pathname: string): string {
	const path = pathname.replace(/\/+$/, '');
	return `/og${path || '/index'}.png`;
}

/**
 * Points a page's Open Graph image at its generated share card.
 *
 * A page that sets its own image keeps it: only the site-wide default
 * (`/og.jpg`) or a missing image is replaced. The `image_src` link is how
 * prerendering finds the card, since it only follows links on its own origin
 * and the Open Graph image is an absolute URL on `site.url`.
 */
export function withCard(tags: MetaTagsProps, url: Pick<URL, 'pathname'>): MetaTagsProps {
	const image = tags.openGraph?.images?.[0];
	if (image && !image.url.endsWith('/og.jpg')) return tags;

	const path = cardPath(url.pathname);
	return {
		...tags,
		openGraph: {
			...tags.openGraph,
			images: [{ url: `${site.url}${path}`, alt: site.name, width: 1200, height: 630 }]
		},
		twitter: { cardType: 'summary_large_image', ...tags.twitter },
		additionalLinkTags: [...(tags.additionalLinkTags ?? []), { rel: 'image_src', href: path }]
	};
}
