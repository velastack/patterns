async function loadActiveSubscription(locals: App.Locals, userId: string) {
	const subscriptions = await locals.admin
		.collection('stripe_subscriptions')
		.getFullList({
			filter: locals.admin.filter(
				'user = {:user} && (status = "active" || status = "trialing")',
				{ user: userId }
			),
			expand: 'price',
			sort: '-created'
		})
		.catch(() => []);

	const sub = subscriptions[0];
	if (!sub) return null;

	const price = sub.expand?.price;
	let productName: string | null = null;
	if (price?.product) {
		const product = await locals.admin
			.collection('stripe_products')
			.getOne(price.product)
			.catch(() => null);
		productName = product?.name ?? null;
	}

	return {
		id: sub.id,
		status: sub.status as string,
		productName,
		cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end)
	};
}

export const load = async ({ locals }) => {
	const user = locals.pb.authStore.record!;
	const breadcrumbs = [{ title: 'Home', url: '/dashboard' }];
	const subscription = await loadActiveSubscription(locals, user.id);

	return { user, breadcrumbs, subscription };
};
