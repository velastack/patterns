import type Stripe from 'stripe';
import { handlePaymentIntentSucceeded } from './payment-intent/succeeded';
import { handlePaymentMethodAttached } from './payment-method/attached';

/**
 * Routes a verified Stripe event to its handler. Runs inside the stripe-event
 * workflow, so a handler that throws is retried with backoff rather than lost.
 */
export async function dispatchStripeEvent(event: Stripe.Event, locals: App.Locals) {
	switch (event.type) {
		case 'payment_intent.succeeded':
			await handlePaymentIntentSucceeded(event.data.object, locals);
			break;

		case 'payment_method.attached':
			await handlePaymentMethodAttached(event.data.object, locals);
			break;

		default:
			console.log(`Unhandled event type: ${event.type}`);
	}
}
