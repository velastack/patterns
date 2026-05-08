import { form, getRequestEvent } from "$app/server";
import { redirect } from "@sveltejs/kit";
import { setFlash } from "sveltekit-flash-message/server";
import { confirmResetSchema } from "$lib/schemas/confirmReset";

export const confirmResetForm = form(confirmResetSchema, async (data) => {
  const { locals, cookies, params } = getRequestEvent();

  await locals.admin
    .collection("users")
    .confirmPasswordReset(
      params.token as string,
      data.password,
      data.passwordConfirm,
    );

  locals.pb.authStore.clear();
  locals.pb.authStore.clearCookie(cookies);

  setFlash({ type: "toast", message: "Password reset successfully." }, cookies);
  redirect(303, "/login");
});
