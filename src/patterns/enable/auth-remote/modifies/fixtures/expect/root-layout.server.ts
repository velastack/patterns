import { loadFlash } from "sveltekit-flash-message/server";

export const load = loadFlash(async ({ locals, url }) => {
  return {
    canonical: url.href,
    user: locals.pb.authStore.record,
  };
});
