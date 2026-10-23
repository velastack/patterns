import { error } from '@sveltejs/kit';

/** The fields of the synced catalog this page reads. */
interface ProductRecord {
	id: string;
	name?: string;
	/** Stripe's boolean, stored by the sync in a text field. */
	active?: unknown;
	default_price?: string;
	description?: string;
	images?: unknown;
}

interface PriceRecord {
	id: string;
	nickname?: string;
	unit_amount?: number;
	currency?: string;
}

const isActive = (product: ProductRecord) => String(product.active) !== 'false';

const images = (product: ProductRecord): string[] =>
	Array.isArray(product.images)
		? product.images.filter((image): image is string => typeof image === 'string')
		: [];

/**
 * One product and its active one-time prices (sizes, say), by its
 * `metadata.slug` from the Stripe dashboard or its id.
 */
export const load = async ({ locals, params }) => {
	const products = locals.admin.collection('stripe_products');
	const product = await products
		.getFirstListItem<ProductRecord>(
			locals.admin.filter('metadata.slug = {:slug}', { slug: params.product })
		)
		.catch(() => products.getOne<ProductRecord>(params.product))
		.catch(() => null);
	if (!product || !isActive(product)) error(404, 'Not found');

	const prices = await locals.admin.collection('stripe_prices').getFullList<PriceRecord>({
		filter: locals.admin.filter('product = {:product} && active = true && type = "one_time"', {
			product: product.id
		}),
		sort: 'unit_amount'
	});
	const priced = prices.filter((price): price is PriceRecord & { currency: string } =>
		Boolean(price.currency)
	);
	if (priced.length === 0) error(404, 'Not found');

	const name = product.name ?? product.id;
	return {
		product: {
			id: product.id,
			name,
			description: product.description ?? null,
			images: images(product),
			defaultPrice: product.default_price ?? null
		},
		prices: priced.map((price) => ({
			price: price.id,
			name,
			// What the dashboard calls this price, when there is more than one.
			nickname: price.nickname ?? null,
			unitAmount: price.unit_amount ?? 0,
			currency: price.currency
		}))
	};
};
