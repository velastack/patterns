import type { ServerInit } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { handlePocketbase } from '@velastack/pocketbase';
import { startWorker } from '$lib/server/workflows';
import { warmCache } from '$lib/server/cache';

export const handle = handlePocketbase({ pocketbaseUrl: env.POCKETBASE_URL });

export const init: ServerInit = async () => {
	await warmCache();
	await startWorker();
};
