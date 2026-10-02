import type { ServerInit } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { handlePocketbase } from '@velastack/pocketbase';
import { warmCache } from '$lib/server/cache';

export const handle = handlePocketbase({ pocketbaseUrl: env.POCKETBASE_URL });

export async function init() {
	await warmCache();
}

export const init2: ServerInit = () => {};
