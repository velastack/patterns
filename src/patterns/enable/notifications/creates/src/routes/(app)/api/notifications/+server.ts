import { json } from '@sveltejs/kit';

export const GET = async ({ locals }) => {
	const userId = locals.pb.authStore.record!.id;
	const list = await locals.pb.collection('notifications').getList(1, 5, {
		filter: `user = "${userId}" && read = false`,
		sort: '-created'
	});
	return json({ count: list.totalItems, items: list.items });
};
