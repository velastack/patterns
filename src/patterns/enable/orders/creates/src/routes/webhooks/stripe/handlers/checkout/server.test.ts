import { beforeAll, describe, expect, it } from 'vitest';
import type Stripe from 'stripe';
import stripe from '#lib/stripe.js';
import { handleCheckoutSessionCompleted } from './completed';

/**
 * A real test-mode Checkout Session stands in for the webhook's payload: its
 * line items come from Stripe either way, and an unpaid session lists them
 * just as a paid one does.
 */
describe('checkout.session.completed', () => {
	let session: Stripe.Checkout.Session;

	beforeAll(async () => {
		const name = 'Test Product - Orders';
		const found = await stripe.products.search({
			query: `name:"${name}" AND metadata["test"]:"true"`,
			limit: 1
		});
		const product =
			found.data[0] ?? (await stripe.products.create({ name, metadata: { test: 'true' } }));
		const price =
			(await stripe.prices.list({ product: product.id, active: true, limit: 1 })).data[0] ??
			(await stripe.prices.create({ product: product.id, unit_amount: 1500, currency: 'usd' }));
		session = await stripe.checkout.sessions.create({
			mode: 'payment',
			line_items: [{ price: price.id, quantity: 2 }],
			success_url: 'https://example.com/checkout/success',
			cancel_url: 'https://example.com/cart'
		});
	});

	it('records the order and its lines, and a redelivery updates them', async (context) => {
		await handleCheckoutSessionCompleted(session, { admin: context.admin } as App.Locals);

		const order = await context.admin.collection('orders').getOne(session.id);
		expect(order.status).toBe('unpaid');
		expect(order.amount_total).toBe(3000);
		expect(order.currency).toBe('USD');

		const lines = await context.admin.collection('order_lines').getFullList({
			filter: context.admin.filter('order = {:order}', { order: session.id })
		});
		expect(lines).toHaveLength(1);
		expect(lines[0].quantity).toBe(2);
		expect(lines[0].unit_amount).toBe(1500);
		expect(lines[0].name).toBe('Test Product - Orders');

		await handleCheckoutSessionCompleted(session, { admin: context.admin } as App.Locals);
		expect(
			await context.admin.collection('order_lines').getFullList({
				filter: context.admin.filter('order = {:order}', { order: session.id })
			})
		).toHaveLength(1);

		// The lines go with the order.
		await context.admin.collection('orders').delete(session.id);
	});
});
