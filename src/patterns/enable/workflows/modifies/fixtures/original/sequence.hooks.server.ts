import { sequence, type Handle } from '@sveltejs/kit/hooks';
import {
	POCKETBASE_URL,
	POCKETBASE_SUPERUSER_EMAIL,
	POCKETBASE_SUPERUSER_PASSWORD
} from '$app/env/private';
import { handlePocketbase } from '@velastack/pocketbase';
import { building } from '$app/env';

const cors: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);
	return resolve(event);
};

export const handle = sequence(
	cors,
	handlePocketbase({
		pocketbaseUrl: POCKETBASE_URL,
		superuserEmail: POCKETBASE_SUPERUSER_EMAIL,
		superuserPassword: POCKETBASE_SUPERUSER_PASSWORD,
		auth: { protectedRoutes: ['/(app)'] }
	})
);
