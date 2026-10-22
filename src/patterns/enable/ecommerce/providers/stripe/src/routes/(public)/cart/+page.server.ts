import { fail, redirect } from '@sveltejs/kit';
import Stripe from 'stripe';
import stripe from '#lib/stripe.js';

/** What the cart posts: prices and quantities. Stripe supplies everything else. */
function readItems(raw: FormDataEntryValue | null): { price: string; quantity: number }[] | null {
	try {
		const items: unknown = JSON.parse(typeof raw === 'string' ? raw : '');
		if (!Array.isArray(items) || items.length === 0 || items.length > 100) return null;
		const valid = items.every(
			(item) =>
				typeof item?.price === 'string' &&
				Number.isInteger(item?.quantity) &&
				item.quantity >= 1 &&
				item.quantity <= 99
		);
		return valid ? items : null;
	} catch {
		return null;
	}
}

export const actions = {
	checkout: async ({ request, url }) => {
		const items = readItems((await request.formData()).get('items'));
		if (!items) return fail(400, { message: 'Your cart could not be read.' });

		let session: Stripe.Checkout.Session;
		try {
			session = await stripe.checkout.sessions.create({
				mode: 'payment',
				line_items: items,
				allow_promotion_codes: true,
				success_url: `${url.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
				cancel_url: `${url.origin}/cart`
			});
		} catch (error) {
			// An inactive or recurring price, or mixed currencies: Stripe says which.
			if (error instanceof Stripe.errors.StripeError) {
				return fail(400, { message: error.message });
			}
			throw error;
		}

		// SvelteKit 3 redirects off-site only when told to.
		redirect(303, session.url!, { external: true });
	}
};
