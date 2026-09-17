import { z } from 'zod';
import stripe from '$lib/stripe';
import { getAdmin, ow } from '$lib/server/workflows';

/**
 * Gives a user a Stripe customer, reusing one that already carries the email
 * and copying over its saved cards. Signup starts it with the user's id as
 * the idempotency key, so however many times it is started or retried there
 * is one run and one customer per user.
 */
export const linkStripeCustomer = ow.defineWorkflow(
	{
		name: 'link-stripe-customer',
		schema: z.object({ userId: z.string(), email: z.string() }),
		retryPolicy: { maximumAttempts: 5 }
	},
	async ({ input, step }) => {
		const customer = await step.run({ name: 'find-or-create-customer' }, async () => {
			const matching = await stripe.customers.list({
				email: input.email,
				limit: 1,
				expand: ['data.invoice_settings']
			});
			const existing = matching.data[0];
			if (existing) {
				const method = existing.invoice_settings?.default_payment_method;
				return {
					id: existing.id,
					existing: true,
					defaultPaymentMethod: typeof method === 'string' ? method : (method?.id ?? null)
				};
			}
			const created = await stripe.customers.create({ email: input.email });
			return { id: created.id, existing: false, defaultPaymentMethod: null };
		});

		await step.run({ name: 'record-customer' }, async () => {
			const admin = await getAdmin();
			try {
				await admin.collection('stripe_customers').getOne(customer.id);
			} catch {
				await admin.collection('stripe_customers').create({ id: customer.id, user: input.userId });
			}
		});

		if (!customer.existing) return { customerId: customer.id, cards: 0 };

		const cards = await step.run({ name: 'list-cards' }, async () => {
			const methods = await stripe.customers.listPaymentMethods(customer.id, {
				type: 'card',
				allow_redisplay: 'always'
			});
			return methods.data
				.filter((method) => method.allow_redisplay !== 'unspecified')
				.map((method) => ({
					id: method.id,
					brand: method.card?.brand,
					last4: method.card?.last4,
					exp_month: method.card?.exp_month,
					exp_year: method.card?.exp_year
				}));
		});

		await step.run({ name: 'record-cards' }, async () => {
			const admin = await getAdmin();
			for (const card of cards) {
				try {
					await admin.collection('stripe_payment_methods').create({ ...card, customer: customer.id });
				} catch {
					// Already recorded by an earlier attempt.
				}
			}
			if (customer.defaultPaymentMethod) {
				try {
					await admin.collection('stripe_customers').update(customer.id, {
						default_payment_method: customer.defaultPaymentMethod
					});
				} catch {
					// The default card was not one that can be shown again.
				}
			}
		});

		return { customerId: customer.id, cards: cards.length };
	}
);
