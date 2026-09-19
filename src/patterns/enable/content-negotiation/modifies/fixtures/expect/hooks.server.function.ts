import type { Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { handle as handleNegotiate } from "$lib/negotiate";

/** Tags every response with the app version. */
const handleApp: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  response.headers.set("x-app-version", "1");
  return response;
};

export const handle = sequence(handleNegotiate, handleApp);
