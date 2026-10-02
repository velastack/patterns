import type { ServerInit } from '@sveltejs/kit/hooks';
import { POCKETBASE_URL } from '$app/env/private';
import { handlePocketbase } from '@velastack/pocketbase';
import { warmCache } from '#lib/server/cache.js';

export const handle = handlePocketbase({ pocketbaseUrl: POCKETBASE_URL });

export async function init() {
	await warmCache();
}

export const init2: ServerInit = () => {};
