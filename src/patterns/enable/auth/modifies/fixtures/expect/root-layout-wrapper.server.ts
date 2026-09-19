import { loadFlash } from "sveltekit-flash-message/server";

export const load = loadFlash(async ({ locals }) => {
  return {
    team: locals.team,
    user: locals.pb.authStore.record,
  };
});
