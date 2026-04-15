import { loadFlash } from "sveltekit-flash-message/server";

export const load = loadFlash(async ({ locals }) => {
  return {
    // [!code highlight:1]
    user: locals.pb.authStore.record,
  };
});
