import { loadFlash } from "sveltekit-flash-message/server";

export const load = loadFlash(async ({ url }) => {
  return { canonical: url.href };
});
