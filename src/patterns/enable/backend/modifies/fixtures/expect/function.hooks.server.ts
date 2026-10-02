import { sequence, type Handle } from '@sveltejs/kit/hooks';
import {
	POCKETBASE_URL,
	POCKETBASE_SUPERUSER_EMAIL,
	POCKETBASE_SUPERUSER_PASSWORD
} from '$app/env/private';
import { handlePocketbase } from '@velastack/pocketbase';

const handleApp: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('x-app-version', '1');
	return response;
};

export const handle = sequence(
	handleApp,
	handlePocketbase({
		pocketbaseUrl: POCKETBASE_URL,
		superuserEmail: POCKETBASE_SUPERUSER_EMAIL,
		superuserPassword: POCKETBASE_SUPERUSER_PASSWORD
	})
);
