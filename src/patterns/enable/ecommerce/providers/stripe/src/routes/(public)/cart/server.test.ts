import { describe, it, expect, beforeAll, type TestContext } from 'vitest';
import * as devalue from 'devalue';
import type { Match } from '@velastack/kit';
import type { RouteId } from './$types';
import stripe from '#lib/stripe.js';
import type Stripe from 'stripe';

describe('POST /cart?/checkout', () => {
	let price: Stripe.Price;
	let inactivePrice: Stripe.Price;

	beforeAll(async () => {
		const name = 'Test Product - Cart';
		const found = await stripe.products.search({
			query: `name:"${name}" AND metadata["test"]:"true"`,
			limit: 1
		});
		const product =
			found.data[0] ?? (await stripe.products.create({ name, metadata: { test: 'true' } }));

		const prices = async (active: boolean) =>
			(await stripe.prices.list({ product: product.id, active, limit: 1 })).data[0];
		price =
			(await prices(true)) ??
			(await stripe.prices.create({ product: product.id, unit_amount: 1500, currency: 'usd' }));
		inactivePrice =
			(await prices(false)) ??
			(await stripe.prices.create({
				product: product.id,
				unit_amount: 2500,
				currency: 'usd',
				active: false
			}));
	});

	const checkout = (context: TestContext, items: unknown) =>
		context.request
			.post(`${'/cart' satisfies Match<RouteId>}?/checkout`)
			.type('form')
			.send({ items: typeof items === 'string' ? items : JSON.stringify(items) });

	it('redirects to a Stripe Checkout Session', async (context) => {
		const response = await checkout(context, [{ price: price.id, quantity: 2 }]);
		expect(response.body.status).toBe(303);
		expect(response.body.location).toMatch(/^https:\/\/checkout\.stripe\.com\//);
	});

	it('refuses a cart it cannot read', async (context) => {
		for (const items of ['not json', [], [{ price: price.id }], [{ quantity: 1 }]]) {
			const response = await checkout(context, items);
			expect(response.body.status).toBe(400);
		}
	});

	it('refuses quantities outside 1 to 99', async (context) => {
		for (const quantity of [0, 100, 1.5]) {
			const response = await checkout(context, [{ price: price.id, quantity }]);
			expect(response.body.status).toBe(400);
		}
	});

	it("passes on Stripe's reason for a price it won't sell", async (context) => {
		const response = await checkout(context, [{ price: inactivePrice.id, quantity: 1 }]);
		expect(response.body.status).toBe(400);
		expect(devalue.parse(response.body.data).message).toMatch(/inactive|not active/i);
	});
});
