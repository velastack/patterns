import { env } from "$env/dynamic/private";
import { sequence } from "@sveltejs/kit/hooks";
import { handlePocketbase } from "@velastack/pocketbase";
// [!code highlight:1]
import { handle as handleNegotiate } from "$lib/negotiate";

export const handle = sequence(
  // [!code highlight:1]
  handleNegotiate,
  handlePocketbase({
    pocketbaseUrl: env.POCKETBASE_URL,
    superuserEmail: env.POCKETBASE_SUPERUSER_EMAIL,
    superuserPassword: env.POCKETBASE_SUPERUSER_PASSWORD,
  }),
);
