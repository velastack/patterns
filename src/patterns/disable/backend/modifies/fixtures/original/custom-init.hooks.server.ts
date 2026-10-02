import type { ServerInit } from '@sveltejs/kit/hooks';
import { POCKETBASE_URL } from '$app/env/private';
import { handlePocketbase } from '@velastack/pocketbase';
import { startWorker } from '#lib/server/workflows.js';
import { warmCache } from '#lib/server/cache.js';

export const handle = handlePocketbase({ pocketbaseUrl: POCKETBASE_URL });

export const init: ServerInit = async () => {
	await warmCache();
	await startWorker();
};
