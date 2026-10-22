import { linkStripeCustomer } from '#lib/workflows/link-stripe-customer.js';

/**
 * The user's Stripe customer id. Signup starts link-stripe-customer in the
 * background, so a user can get here before it finishes, or without it ever
 * starting (a one-time-code signup, an import). Either way this starts or
 * joins that same run (the user's id is its idempotency key, so there is still
 * one customer) and waits a little for it.
 *
 * Throws when the customer is not there in time; the caller decides whether to
 * say "try again shortly" or fail.
 */
export async function getStripeCustomerId(
	admin: App.Locals['admin'],
	user: { id: string; email?: string },
	timeoutMs = 10_000
): Promise<string> {
	try {
		const customer = await admin
			.collection('stripe_customers')
			.getFirstListItem(admin.filter('user = {:user}', { user: user.id }));
		return customer.id;
	} catch {
		// Not linked yet.
	}

	const handle = await linkStripeCustomer.run(
		{ userId: user.id, email: user.email || undefined },
		{ idempotencyKey: user.id }
	);
	const { customerId } = await handle.result({ timeoutMs });
	return customerId;
}
