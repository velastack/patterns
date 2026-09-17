import type Stripe from 'stripe';
import { getAdmin, ow } from '$lib/server/workflows';
import { dispatchStripeEvent } from '../../routes/webhooks/stripe/handlers/dispatch';

/**
 * One run per Stripe event, keyed on the event id by the webhook route, so
 * Stripe's retries and a replay from its dashboard land on the run that
 * already exists. A handler that throws is retried with backoff; the run and
 * its error are listed under Workflows in the PocketBase dashboard.
 */
export const handleStripeEvent = ow.defineWorkflow<Stripe.Event, void>(
	{ name: 'stripe-event', retryPolicy: { maximumAttempts: 5 } },
	async ({ input: event, step }) => {
		await step.run({ name: event.type }, async () => {
			const admin = await getAdmin();
			await dispatchStripeEvent(event, { admin } as App.Locals);
		});
	}
);
