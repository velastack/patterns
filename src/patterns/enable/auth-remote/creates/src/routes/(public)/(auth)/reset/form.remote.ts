import { form, getRequestEvent } from "$app/server";
import { setFlash } from "sveltekit-flash-message/server";
import { resetSchema } from "$lib/schemas/reset";

export const resetForm = form(resetSchema, async (data) => {
  const { locals, cookies } = getRequestEvent();

  await locals.pb.collection("users").requestPasswordReset(data.email);
  setFlash(
    {
      type: "toast",
      message: "We sent a password reset link to your email.",
    },
    cookies,
  );

  return { success: true };
});
