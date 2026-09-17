import type { ServerInit } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { handlePocketbase } from '@velastack/pocketbase';

export const handle = handlePocketbase({
	pocketbaseUrl: env.POCKETBASE_URL,
	superuserEmail: env.POCKETBASE_SUPERUSER_EMAIL,
	superuserPassword: env.POCKETBASE_SUPERUSER_PASSWORD
});

export const init: ServerInit = async () => {
	console.log('starting');
};
