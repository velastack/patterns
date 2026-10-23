import { error } from '@sveltejs/kit';
import { currencyFrom } from '#lib/currency.svelte.js';
import { marketCountry, storefront } from '#lib/shopify.js';
import type { Money } from '../+page.js';

export interface Variant {
	id: string;
	title: string;
	availableForSale: boolean;
	price: Money;
	selectedOptions: { name: string; value: string }[];
}

export interface Product {
	id: string;
	title: string;
	descriptionHtml: string;
	images: { nodes: { url: string; altText: string | null }[] };
	options: { name: string; optionValues: { name: string }[] }[];
	variants: { nodes: Variant[] };
}

const PRODUCT = `#graphql
	query Product($handle: String!, $country: CountryCode) @inContext(country: $country) {
		product(handle: $handle) {
			id
			title
			descriptionHtml
			images(first: 4) {
				nodes {
					url
					altText
				}
			}
			options {
				name
				optionValues {
					name
				}
			}
			variants(first: 100) {
				nodes {
					id
					title
					availableForSale
					price {
						amount
						currencyCode
					}
					selectedOptions {
						name
						value
					}
				}
			}
		}
	}
`;

export const prerender = false;

export const load = async ({ params, parent }) => {
	const country = await marketCountry(currencyFrom(await parent()));
	const { data, errors } = await storefront().request(PRODUCT, {
		variables: { handle: params.handle, country }
	});
	if (errors) error(502, errors.message ?? 'Shopify did not answer.');
	const product = data?.product as Product | null | undefined;
	if (!product) error(404, 'Not found');
	return { product };
};
