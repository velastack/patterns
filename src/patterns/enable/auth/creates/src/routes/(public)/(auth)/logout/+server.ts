import { redirect } from "@sveltejs/kit";

export const POST = ({ cookies, locals }) => {
  locals.pb.authStore.clear();
  locals.pb.authStore.clearCookie(cookies);
  redirect(303, "/");
};
