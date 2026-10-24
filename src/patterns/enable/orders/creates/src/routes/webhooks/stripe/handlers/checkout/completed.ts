import type Stripe from 'stripe';
import { syncOrder } from './shared';

/** `checkout.session.completed`: the buyer finished Checkout; the payment may still be settling. */
export async function handleCheckoutSessionCompleted(
	session: Stripe.Checkout.Session,
	locals: App.Locals
) {
	await syncOrder(session, locals);
}
