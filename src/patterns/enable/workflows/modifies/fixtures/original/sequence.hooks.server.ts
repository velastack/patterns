import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { env } from '$env/dynamic/private';
import { handlePocketbase } from '@velastack/pocketbase';
import { building } from '$app/env';

const cors: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);
	return resolve(event);
};

export const handle = sequence(
	cors,
	handlePocketbase({
		pocketbaseUrl: env.POCKETBASE_URL!,
		superuserEmail: env.POCKETBASE_SUPERUSER_EMAIL,
		superuserPassword: env.POCKETBASE_SUPERUSER_PASSWORD,
		auth: { protectedRoutes: ['/(app)'] }
	})
);
