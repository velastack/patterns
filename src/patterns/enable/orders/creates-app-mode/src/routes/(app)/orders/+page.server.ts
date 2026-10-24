import { redirect } from '@sveltejs/kit';

/** The fields of an order this page reads. */
interface OrderRecord {
	id: string;
	status: string;
	amount_total: number;
	currency: string;
	created: string;
}

/** The signed-in user's orders, newest first. */
export const load = async ({ locals, parent }) => {
	const { user } = await parent();
	if (!user) redirect(303, '/login');

	const orders = await locals.admin.collection('orders').getFullList<OrderRecord>({
		filter: locals.admin.filter('user = {:user}', { user: user.id }),
		sort: '-created'
	});

	return {
		orders: orders.map((order) => ({
			id: order.id,
			status: order.status,
			amountTotal: order.amount_total,
			currency: order.currency,
			created: order.created
		}))
	};
};
