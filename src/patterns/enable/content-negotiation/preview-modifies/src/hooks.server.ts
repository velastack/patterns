import {
  POCKETBASE_URL,
  POCKETBASE_SUPERUSER_EMAIL,
  POCKETBASE_SUPERUSER_PASSWORD,
} from "$env/static/private";
import { sequence } from "@sveltejs/kit/hooks";
import { handlePocketbase } from "@velastack/pocketbase";
// [!code highlight:1]
import { handle as handleNegotiate } from "$lib/negotiate";

export const handle = sequence(
  // [!code highlight:1]
  handleNegotiate,
  handlePocketbase({
    pocketbaseUrl: POCKETBASE_URL,
    superuserEmail: POCKETBASE_SUPERUSER_EMAIL,
    superuserPassword: POCKETBASE_SUPERUSER_PASSWORD,
  }),
);
