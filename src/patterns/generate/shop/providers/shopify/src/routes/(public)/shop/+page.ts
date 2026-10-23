import { error } from '@sveltejs/kit';
import { storefront } from '#lib/shopify.js';

export interface Money {
	amount: string;
	currencyCode: string;
}

export interface ProductCard {
	id: string;
	handle: string;
	title: string;
	featuredImage: { url: string; altText: string | null } | null;
	priceRange: { minVariantPrice: Money };
}

const PRODUCTS = `#graphql
	query Products {
		products(first: 100, sortKey: TITLE) {
			nodes {
				id
				handle
				title
				featuredImage {
					url
					altText
				}
				priceRange {
					minVariantPrice {
						amount
						currencyCode
					}
				}
			}
		}
	}
`;

// The Storefront token is public, so the same load runs on the server and in
// the browser. It is not prerendered: the catalog changes without a rebuild.
export const prerender = false;

export const load = async () => {
	const { data, errors } = await storefront().request(PRODUCTS);
	if (errors) error(502, errors.message ?? 'Shopify did not answer.');
	return { products: (data?.products.nodes ?? []) as ProductCard[] };
};
