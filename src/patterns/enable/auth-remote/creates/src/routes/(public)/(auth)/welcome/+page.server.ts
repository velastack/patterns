import { redirect } from "@sveltejs/kit";
import { nextUrl } from "./next-url";

// Accounts made with a one-time code start without a name, so signup sends
// them here once the code checks out, to pick the name the app shows.
export const load = async ({ locals, url }) => {
  if (!locals.pb.authStore.isValid) {
    redirect(303, "/login");
  }
  if (locals.pb.authStore.record?.name) {
    redirect(303, nextUrl(url));
  }

  return { next: nextUrl(url) };
};
