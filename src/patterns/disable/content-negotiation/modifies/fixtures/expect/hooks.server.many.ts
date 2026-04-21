import { sequence } from "@sveltejs/kit/hooks";
import { env } from "$env/dynamic/private";
import { handlePocketbase } from "@velastack/pocketbase";
const handleFirst = async ({ event, resolve }) => resolve(event);

export const handle = sequence(
  handleFirst,
  handlePocketbase({
    pocketbaseUrl: env.POCKETBASE_URL,
    superuserEmail: env.POCKETBASE_SUPERUSER_EMAIL,
    superuserPassword: env.POCKETBASE_SUPERUSER_PASSWORD,
  }),
);
