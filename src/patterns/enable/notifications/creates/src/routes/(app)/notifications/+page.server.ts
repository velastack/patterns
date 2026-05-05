import { fail } from '@sveltejs/kit';

export const load = async ({ locals }) => {
	const userId = locals.pb.authStore.record!.id;
	const items = await locals.pb.collection('notifications').getFullList({
		filter: `user = "${userId}"`,
		sort: '-created'
	});
	const unread = items.filter((n) => !n.read).length;
	const breadcrumbs = [
		{ title: 'Home', url: '/dashboard' },
		{ title: 'Notifications', url: '/notifications' }
	];
	return { items, unread, breadcrumbs };
};

export const actions = {
	markRead: async ({ request, locals }) => {
		const form = await request.formData();
		const id = form.get('id');
		if (typeof id !== 'string' || !id) return fail(400, { error: 'missing id' });
		await locals.pb.collection('notifications').update(id, { read: true });
		return { success: true };
	},
	markAllRead: async ({ locals }) => {
		const userId = locals.pb.authStore.record!.id;
		const unread = await locals.pb.collection('notifications').getFullList({
			filter: `user = "${userId}" && read = false`
		});
		for (const n of unread) {
			await locals.pb.collection('notifications').update(n.id, { read: true });
		}
		return { success: true, count: unread.length };
	}
};
