import { form, getRequestEvent } from "$app/server";
import { redirect } from "@sveltejs/kit";
import { welcomeSchema } from "#lib/schemas/welcome.js";
import { nextUrl } from "./next-url";

export const welcomeForm = form(welcomeSchema, async (data) => {
  const { locals, url } = getRequestEvent();

  if (!locals.pb.authStore.isValid) {
    redirect(303, "/login");
  }

  await locals.pb
    .collection("users")
    .update(locals.pb.authStore.record!.id, { name: data.name.trim() });

  redirect(303, nextUrl(url));
});
