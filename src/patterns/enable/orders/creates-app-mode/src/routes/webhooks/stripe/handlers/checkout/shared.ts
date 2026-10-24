import type Stripe from 'stripe';
import type { RecordModel } from 'pocketbase';
import stripe from '#lib/stripe.js';

/**
 * What a Checkout Session becomes in `orders`: keyed by the session id, so a
 * redelivered or replayed event updates the row it already made. `status` is
 * Stripe's `payment_status` (`paid`, `unpaid`, `no_payment_required`); an
 * order whose payment clears later (a bank debit) is created `unpaid` and
 * updated by the async payment event.
 *
 * A signed-in buyer checked out as their Stripe customer, which
 * `stripe_customers` maps back to the user; a guest has only an email.
 */
export async function orderRecordFields(session: Stripe.Checkout.Session, locals: App.Locals) {
	const paymentIntent =
		typeof session.payment_intent === 'string'
			? session.payment_intent
			: (session.payment_intent?.id ?? null);
	const customerId =
		typeof session.customer === 'string' ? session.customer : (session.customer?.id ?? null);
	const customer = customerId
		? await locals.admin
				.collection('stripe_customers')
				.getOne<{ id: string; user: string }>(customerId)
				.catch(() => null)
		: null;
	return {
		status: session.payment_status,
		amount_total: session.amount_total ?? 0,
		currency: (session.currency ?? '').toUpperCase(),
		email: session.customer_details?.email ?? null,
		payment_intent: paymentIntent,
		customer: customer?.id ?? null,
		user: customer?.user ?? null
	};
}

/**
 * Records the session as an order with its lines, from Stripe's own line
 * items (the webhook payload carries none). Returns the stored order.
 */
export async function syncOrder(
	session: Stripe.Checkout.Session,
	locals: App.Locals
): Promise<RecordModel> {
	const orders = locals.admin.collection('orders');
	const fields = await orderRecordFields(session, locals);
	let order: RecordModel;
	try {
		order = await orders.update(session.id, fields);
	} catch {
		order = await orders.create({ id: session.id, ...fields });
	}

	const lines = locals.admin.collection('order_lines');
	for await (const line of stripe.checkout.sessions.listLineItems(session.id, {
		limit: 100,
		expand: ['data.price.product']
	})) {
		const product = line.price?.product;
		const lineFields = {
			order: session.id,
			price: line.price?.id ?? null,
			product: typeof product === 'string' ? product : (product?.id ?? null),
			name: line.description,
			unit_amount: line.price?.unit_amount ?? null,
			quantity: line.quantity ?? 1,
			amount_total: line.amount_total,
			currency: line.currency.toUpperCase()
		};
		try {
			await lines.update(line.id, lineFields);
		} catch {
			await lines.create({ id: line.id, ...lineFields });
		}
	}
	return order;
}
