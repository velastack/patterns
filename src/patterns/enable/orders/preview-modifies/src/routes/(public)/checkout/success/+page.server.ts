import { error } from '@sveltejs/kit';
import stripe from '#lib/stripe.js';

interface OrderRecord {
	status: string;
	amount_total: number;
	currency: string;
}

interface OrderLineRecord {
	id: string;
	name: string;
	quantity: number;
	amount_total: number;
	currency: string;
}

/**
 * The order as the webhook recorded it, with its lines; until that event has
 * arrived (it usually has), Stripe's own summary of the session.
 */
export const load = async ({ url, locals }) => {
	const id = url.searchParams.get('session_id');
	if (!id) error(404, 'Not found');

	const order = await locals.admin
		.collection('orders')
		.getOne<OrderRecord>(id)
		.catch(() => null);
	if (order) {
		const lines = await locals.admin.collection('order_lines').getFullList<OrderLineRecord>({
			filter: locals.admin.filter('order = {:order}', { order: id }),
			sort: 'created'
		});
		return {
			amountTotal: order.amount_total,
			currency: order.currency,
			paid: order.status === 'paid',
			lines: lines.map((line) => ({
				id: line.id,
				name: line.name,
				quantity: line.quantity,
				amountTotal: line.amount_total,
				currency: line.currency
			}))
		};
	}

	try {
		const session = await stripe.checkout.sessions.retrieve(id);
		return {
			amountTotal: session.amount_total,
			currency: session.currency,
			paid: session.payment_status === 'paid',
			lines: []
		};
	} catch {
		error(404, 'Not found');
	}
};
