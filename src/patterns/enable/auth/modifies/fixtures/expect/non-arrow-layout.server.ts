export function load({ locals }) {
	return {
		meta: locals.meta,
		user: locals.pb.authStore.record
	};
}
