import type Stripe from 'stripe';
import { handlePaymentIntentSucceeded } from './payment-intent/succeeded';
import { handlePaymentMethodAttached } from './payment-method/attached';
import { handleCheckoutSessionCompleted } from './checkout/completed';
import { handleCheckoutAsyncPayment } from './checkout/async-payment';

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

		case 'checkout.session.completed':
			await handleCheckoutSessionCompleted(event.data.object, locals);
			break;

		case 'checkout.session.async_payment_succeeded':
		case 'checkout.session.async_payment_failed':
			await handleCheckoutAsyncPayment(event.data.object, locals);
			break;

		default:
			console.log(`Unhandled event type: ${event.type}`);
	}
}
