import { error } from '@sveltejs/kit';
import stripe from '#lib/stripe.js';

export const load = async ({ url }) => {
	const id = url.searchParams.get('session_id');
	if (!id) error(404, 'Not found');

	try {
		const session = await stripe.checkout.sessions.retrieve(id);
		return {
			amountTotal: session.amount_total,
			currency: session.currency,
			paid: session.payment_status === 'paid'
		};
	} catch {
		error(404, 'Not found');
	}
};
