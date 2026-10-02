// [!code highlight:1]
import { sequence, type ServerInit } from "@sveltejs/kit/hooks";
import {
  POCKETBASE_URL,
  POCKETBASE_SUPERUSER_EMAIL,
  POCKETBASE_SUPERUSER_PASSWORD,
} from "$app/env/private";
import { handlePocketbase } from "@velastack/pocketbase";
import { startWorker } from "#lib/server/workflows.js";
// [!code highlight:1]
import { handle as handleNegotiate } from "#lib/negotiate.js";

// [!code highlight:2]
export const handle = sequence(
  handleNegotiate,
  handlePocketbase({
    pocketbaseUrl: POCKETBASE_URL,
    superuserEmail: POCKETBASE_SUPERUSER_EMAIL,
    superuserPassword: POCKETBASE_SUPERUSER_PASSWORD,
  }),
  // [!code highlight:1]
);

// Runs once when the server starts: executes the workflows in src/lib/workflows.
export const init: ServerInit = () => startWorker();
