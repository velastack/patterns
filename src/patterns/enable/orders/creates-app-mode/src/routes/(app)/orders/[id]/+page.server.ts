import { error, redirect } from '@sveltejs/kit';

interface OrderRecord {
	id: string;
	status: string;
	amount_total: number;
	currency: string;
	email: string | null;
	user: string;
	created: string;
}

interface OrderLineRecord {
	id: string;
	name: string;
	quantity: number;
	unit_amount: number | null;
	amount_total: number;
	currency: string;
}

/** One of the signed-in user's orders, with its lines. Anyone else's is not found. */
export const load = async ({ locals, params, parent }) => {
	const { user } = await parent();
	if (!user) redirect(303, '/login');

	const order = await locals.admin
		.collection('orders')
		.getOne<OrderRecord>(params.id)
		.catch(() => null);
	if (!order || order.user !== user.id) error(404, 'Not found');

	const lines = await locals.admin.collection('order_lines').getFullList<OrderLineRecord>({
		filter: locals.admin.filter('order = {:order}', { order: order.id }),
		sort: 'created'
	});

	return {
		order: {
			id: order.id,
			status: order.status,
			amountTotal: order.amount_total,
			currency: order.currency,
			email: order.email,
			created: order.created
		},
		lines: lines.map((line) => ({
			id: line.id,
			name: line.name,
			quantity: line.quantity,
			unitAmount: line.unit_amount,
			amountTotal: line.amount_total,
			currency: line.currency
		}))
	};
};
