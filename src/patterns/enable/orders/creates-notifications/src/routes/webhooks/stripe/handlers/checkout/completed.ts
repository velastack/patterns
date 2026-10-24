import type Stripe from 'stripe';
import { notify } from '#lib/server/notifications.js';
import { formatAmount } from '#lib/cart.svelte.js';
import { syncOrder } from './shared';

/**
 * `checkout.session.completed`: the buyer finished Checkout; the payment may
 * still be settling. A signed-in buyer gets a notification once it is paid.
 */
export async function handleCheckoutSessionCompleted(
	session: Stripe.Checkout.Session,
	locals: App.Locals
) {
	const order = await syncOrder(session, locals);
	if (order.user && order.status === 'paid') {
		await notify(locals.admin, order.user, {
			title: 'Order received',
			body: `Your order of ${formatAmount(order.amount_total, order.currency)} is confirmed.`
		});
	}
}
