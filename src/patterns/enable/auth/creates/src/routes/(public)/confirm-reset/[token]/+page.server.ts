import { fail, superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { confirmResetSchema } from "$lib/schemas/confirmReset";
import { redirect } from "@sveltejs/kit";
import { setFlash } from "sveltekit-flash-message/server";

export const load = async () => {
  return { form: await superValidate(zod(confirmResetSchema)) };
};

export const actions = {
  default: async ({ locals, request, params, cookies }) => {
    const form = await superValidate(request, zod(confirmResetSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    await locals.admin
      .collection("users")
      .confirmPasswordReset(
        params.token,
        form.data.password,
        form.data.passwordConfirm,
      );

    locals.pb.authStore.clear();
    locals.pb.authStore.clearCookie(cookies);

    setFlash(
      { type: "toast", message: "Password reset successfully." },
      cookies,
    );
    return redirect(303, "/login");
  },
};
