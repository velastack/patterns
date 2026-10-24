import type Stripe from 'stripe';
import { syncOrder } from './shared';

/**
 * `checkout.session.async_payment_succeeded` and `_failed`: a payment that
 * settles after Checkout (a bank debit, a voucher) is now final either way,
 * and the order's status follows the session's.
 */
export async function handleCheckoutAsyncPayment(
	session: Stripe.Checkout.Session,
	locals: App.Locals
) {
	await syncOrder(session, locals);
}
