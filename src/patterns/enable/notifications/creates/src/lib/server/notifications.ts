import type PocketBase from 'pocketbase';

export interface NotifyInput {
	title: string;
	body?: string;
}

/** Drop a notification on a user. Server-only ($lib/server). */
export async function notify(pb: PocketBase, userId: string, input: NotifyInput) {
	return pb.collection('notifications').create({
		user: userId,
		title: input.title,
		body: input.body ?? '',
		read: false
	});
}
