import { getAdmin, ow } from '$lib/server/workflows';
import { linkStripeCustomer } from './link-stripe-customer';

/**
 * The safety net for users that did not come through signup (the dashboard,
 * an import): starts link-stripe-customer for each one without a customer.
 * The idempotency key means a user whose run already exists, finished or
 * still retrying, is left alone.
 */
export const syncStripeCustomers = ow.defineWorkflow(
	{ name: 'sync-stripe-customers', retryPolicy: { maximumAttempts: 3 } },
	async ({ step }) => {
		const users = await step.run({ name: 'find-unlinked' }, async () => {
			const admin = await getAdmin();
			const rows = await admin
				.collection('users')
				.getFullList({ filter: 'stripe_customers_via_user.id = null' });
			return rows.filter((user) => user.email).map((user) => ({ id: user.id, email: user.email }));
		});

		await step.run({ name: 'start-links' }, async () => {
			for (const user of users) {
				await linkStripeCustomer.run(
					{ userId: user.id, email: user.email },
					{ idempotencyKey: user.id }
				);
			}
		});

		return { queued: users.length };
	}
);

export const cron = '*/10 * * * *';
