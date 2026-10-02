import {
  POCKETBASE_URL,
  POCKETBASE_SUPERUSER_EMAIL,
  POCKETBASE_SUPERUSER_PASSWORD,
} from "$app/env/private";
import { handlePocketbase } from "@velastack/pocketbase";
import { handle as handleNegotiate } from "#lib/negotiate.js";
import { sequence } from "@sveltejs/kit/hooks";

export const handle = sequence(
  handleNegotiate,
  handlePocketbase({
    pocketbaseUrl: POCKETBASE_URL,
    superuserEmail: POCKETBASE_SUPERUSER_EMAIL,
    superuserPassword: POCKETBASE_SUPERUSER_PASSWORD,
  }),
);
