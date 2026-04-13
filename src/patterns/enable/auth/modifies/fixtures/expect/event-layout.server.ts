export const load = async ({ locals, ...event }) => {
	return {
		user: locals.pb.authStore.record
	};
};
