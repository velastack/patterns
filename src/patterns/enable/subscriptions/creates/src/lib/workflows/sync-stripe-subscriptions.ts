import stripe from '$lib/stripe';
import { getAdmin, ow } from '$lib/server/workflows';
import { subscriptionRecordFields } from '../../routes/webhooks/stripe/handlers/subscription/shared';

/**
 * Brings stripe_subscriptions in line with Stripe, all of them, so a webhook
 * that never arrived is corrected within ten minutes.
 */
export const syncStripeSubscriptions = ow.defineWorkflow(
	{ name: 'sync-stripe-subscriptions', retryPolicy: { maximumAttempts: 3 } },
	async ({ step }) => {
		const subscriptions = await step.run({ name: 'list' }, async () => {
			const rows = [];
			for await (const subscription of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
				const fields = subscriptionRecordFields(subscription);
				if (fields) rows.push(fields);
			}
			return rows;
		});

		return step.run({ name: 'upsert' }, async () => {
			const admin = await getAdmin();
			let synced = 0;
			let skipped = 0;
			for (const fields of subscriptions) {
				let customer;
				try {
					customer = await admin.collection('stripe_customers').getOne(fields.customer);
				} catch {
					// A customer this app does not know about.
					skipped += 1;
					continue;
				}
				try {
					await admin.collection('stripe_subscriptions').update(fields.id, fields);
				} catch {
					await admin.collection('stripe_subscriptions').create({ ...fields, user: customer.user });
				}
				synced += 1;
			}
			return { synced, skipped };
		});
	}
);

export const cron = '*/10 * * * *';
