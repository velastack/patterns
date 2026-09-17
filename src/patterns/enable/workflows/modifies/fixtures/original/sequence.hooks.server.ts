import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { handlePocketbase } from '@velastack/pocketbase';
import { building } from '$app/environment';

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
