export interface NotifyInput {
	title: string;
	body?: string;
}

/**
 * Drop a notification on a user. Server-only (src/lib/server): from a load or
 * action with `locals.pb`, or from a webhook handler with `locals.admin`.
 */
export async function notify(pb: App.Locals['pb'], userId: string, input: NotifyInput) {
	return pb.collection('notifications').create({
		user: userId,
		title: input.title,
		body: input.body ?? '',
		read: false
	});
}
