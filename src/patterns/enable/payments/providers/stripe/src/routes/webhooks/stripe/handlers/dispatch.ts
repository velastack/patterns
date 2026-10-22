import type Stripe from 'stripe';
import { handlePaymentIntentSucceeded } from './payment-intent/succeeded';

/**
 * Routes a verified Stripe event to its handler. Runs inside the stripe-event
 * workflow, so a handler that throws is retried with backoff rather than lost.
 */
export async function dispatchStripeEvent(event: Stripe.Event, locals: App.Locals) {
	switch (event.type) {
		case 'payment_intent.succeeded':
			await handlePaymentIntentSucceeded(event.data.object, locals);
			break;

		default:
			console.log(`Unhandled event type: ${event.type}`);
	}
}
