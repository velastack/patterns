import { sequence, type Handle, type ServerInit } from '@sveltejs/kit/hooks';
import {
	POCKETBASE_URL,
	POCKETBASE_SUPERUSER_EMAIL,
	POCKETBASE_SUPERUSER_PASSWORD
} from '$app/env/private';
import { handlePocketbase } from '@velastack/pocketbase';
import { building } from '$app/env';
import { startWorker } from '#lib/server/workflows.js';

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

// Runs once when the server starts: executes the workflows in src/lib/workflows.
export const init: ServerInit = () => startWorker();
