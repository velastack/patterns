import { env } from "$env/dynamic/private";
import { handlePocketbase } from "@velastack/pocketbase";
import { handle as handleNegotiate } from "$lib/negotiate";
import { sequence } from "@sveltejs/kit/hooks";

export const handle = sequence(
  handleNegotiate,
  handlePocketbase({
    pocketbaseUrl: env.POCKETBASE_URL,
    superuserEmail: env.POCKETBASE_SUPERUSER_EMAIL,
    superuserPassword: env.POCKETBASE_SUPERUSER_PASSWORD,
  }),
);
