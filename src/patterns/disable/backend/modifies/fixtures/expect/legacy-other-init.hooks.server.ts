import type { ServerInit } from '@sveltejs/kit';
import { warmCache } from '$lib/server/cache';

export async function init() {
	await warmCache();
}

export const init2: ServerInit = () => {};
