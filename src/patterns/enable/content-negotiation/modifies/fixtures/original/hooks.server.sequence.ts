import { sequence } from "@sveltejs/kit/hooks";
import {
  POCKETBASE_URL,
  POCKETBASE_SUPERUSER_EMAIL,
  POCKETBASE_SUPERUSER_PASSWORD,
} from "$app/env/private";
import { handlePocketbase } from "@velastack/pocketbase";

const handleFirst = async ({ event, resolve }) => resolve(event);

export const handle = sequence(
  handleFirst,
  handlePocketbase({
    pocketbaseUrl: POCKETBASE_URL,
    superuserEmail: POCKETBASE_SUPERUSER_EMAIL,
    superuserPassword: POCKETBASE_SUPERUSER_PASSWORD,
  }),
);
