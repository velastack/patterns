import { priceOptions } from '#lib/cart.svelte.js';

/** The fields of the synced catalog this page reads. */
interface ProductRecord {
	id: string;
	name?: string;
	/** Stripe's boolean, stored by the sync in a text field. */
	active?: unknown;
	default_price?: string;
	description?: string;
	images?: unknown;
	metadata?: unknown;
}

interface PriceRecord {
	id: string;
	product?: string;
	unit_amount?: number;
	currency?: string;
	currency_options?: unknown;
}

const isActive = (product: ProductRecord) => String(product.active) !== 'false';

const slugOf = (product: ProductRecord): string => {
	const metadata = product.metadata as { slug?: unknown } | null | undefined;
	return typeof metadata?.slug === 'string' && metadata.slug ? metadata.slug : product.id;
};

const firstImage = (product: ProductRecord): string | null =>
	Array.isArray(product.images) && typeof product.images[0] === 'string'
		? product.images[0]
		: null;

/**
 * The catalog, as the sync copied it from Stripe: every active product with
 * its default one-time price (or its first active one). A product's
 * `metadata.slug`, when set in the Stripe dashboard, names its page.
 */
export const load = async ({ locals }) => {
	const [products, prices] = await Promise.all([
		locals.admin.collection('stripe_products').getFullList<ProductRecord>({ sort: 'name' }),
		locals.admin
			.collection('stripe_prices')
			.getFullList<PriceRecord>({ filter: 'active = true && type = "one_time"' })
	]);

	return {
		products: products.filter(isActive).flatMap((product) => {
			const price =
				prices.find((candidate) => candidate.id === product.default_price) ??
				prices.find((candidate) => candidate.product === product.id);
			if (!price?.currency) return [];
			const name = product.name ?? product.id;
			return [
				{
					id: product.id,
					slug: slugOf(product),
					name,
					description: product.description ?? null,
					image: firstImage(product),
					price: {
						price: price.id,
						name,
						unitAmount: price.unit_amount ?? 0,
						currency: price.currency,
						options: priceOptions(price.currency_options)
					}
				}
			];
		})
	};
};
