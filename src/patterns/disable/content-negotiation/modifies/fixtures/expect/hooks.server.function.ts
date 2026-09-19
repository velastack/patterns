import type { Handle } from "@sveltejs/kit";

/** Tags every response with the app version. */
export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  response.headers.set("x-app-version", "1");
  return response;
};
