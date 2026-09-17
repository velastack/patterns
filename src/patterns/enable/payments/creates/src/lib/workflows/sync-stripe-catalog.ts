import stripe from '$lib/stripe';
import { getAdmin, ow } from '$lib/server/workflows';

/** Copies every Stripe product into stripe_products, adding new ones and updating the rest. */
export const syncStripeProducts = ow.defineWorkflow(
	{ name: 'sync-stripe-products', retryPolicy: { maximumAttempts: 3 } },
	async ({ step }) => {
		const products = await step.run({ name: 'list' }, async () => {
			const rows = [];
			for await (const product of stripe.products.list({ limit: 100 })) {
				rows.push({
					id: product.id,
					name: product.name,
					active: product.active,
					default_price:
						typeof product.default_price === 'string'
							? product.default_price
							: (product.default_price?.id ?? null)
				});
			}
			return rows;
		});

		await step.run({ name: 'upsert' }, async () => {
			const admin = await getAdmin();
			for (const product of products) {
				try {
					await admin.collection('stripe_products').update(product.id, product);
				} catch {
					await admin.collection('stripe_products').create(product);
				}
			}
		});

		return { synced: products.length };
	}
);

/** The same for prices. */
export const syncStripePrices = ow.defineWorkflow(
	{ name: 'sync-stripe-prices', retryPolicy: { maximumAttempts: 3 } },
	async ({ step }) => {
		const prices = await step.run({ name: 'list' }, async () => {
			const rows = [];
			for await (const price of stripe.prices.list({ limit: 100 })) {
				rows.push({
					id: price.id,
					billing_scheme: price.billing_scheme,
					currency: price.currency,
					product: typeof price.product === 'string' ? price.product : price.product.id,
					recurring: price.recurring,
					type: price.type,
					unit_amount: price.unit_amount,
					active: price.active
				});
			}
			return rows;
		});

		await step.run({ name: 'upsert' }, async () => {
			const admin = await getAdmin();
			for (const price of prices) {
				try {
					await admin.collection('stripe_prices').update(price.id, price);
				} catch {
					await admin.collection('stripe_prices').create(price);
				}
			}
		});

		return { synced: prices.length };
	}
);

/** Both run on this schedule; a product or price changed in Stripe shows up within ten minutes. */
export const cron = '*/10 * * * *';
