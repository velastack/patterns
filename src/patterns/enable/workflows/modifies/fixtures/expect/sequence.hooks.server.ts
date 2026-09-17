import { sequence } from '@sveltejs/kit/hooks';
import type { Handle, ServerInit } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { handlePocketbase } from '@velastack/pocketbase';
import { building } from '$app/environment';
import { startWorker } from '$lib/server/workflows';

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

// Runs once when the server starts: executes the workflows in src/lib/workflows.
export const init: ServerInit = () => startWorker();
