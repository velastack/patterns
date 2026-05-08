import { form, getRequestEvent } from "$app/server";
import { redirect } from "@sveltejs/kit";
import { setFlash } from "sveltekit-flash-message/server";
import { confirmEmailChangeSchema } from "$lib/schemas/confirmEmailChange";

export const confirmEmailChangeForm = form(
  confirmEmailChangeSchema,
  async (data) => {
    const { locals, cookies, params } = getRequestEvent();

    await locals.admin
      .collection("users")
      .confirmEmailChange(params.token as string, data.password);

    locals.pb.authStore.clear();
    locals.pb.authStore.clearCookie(cookies);

    setFlash(
      { type: "toast", message: "Email changed successfully." },
      cookies,
    );
    redirect(303, "/login");
  },
);
