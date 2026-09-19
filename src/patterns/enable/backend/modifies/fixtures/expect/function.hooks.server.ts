import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { env } from '$env/dynamic/private';
import { handlePocketbase } from '@velastack/pocketbase';

const handleApp: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('x-app-version', '1');
	return response;
};

export const handle = sequence(
	handleApp,
	handlePocketbase({
		pocketbaseUrl: env.POCKETBASE_URL,
		superuserEmail: env.POCKETBASE_SUPERUSER_EMAIL,
		superuserPassword: env.POCKETBASE_SUPERUSER_PASSWORD
	})
);
