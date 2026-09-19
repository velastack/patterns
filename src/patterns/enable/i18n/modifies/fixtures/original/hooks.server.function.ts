/** Tags every response with the app version. */
export async function handle({ event, resolve }) {
  const response = await resolve(event);
  response.headers.set("x-app-version", "1");
  return response;
}
