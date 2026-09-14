import { fail, superValidate } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { confirmResetSchema } from "$lib/schemas/confirmReset";
import { redirect } from "@sveltejs/kit";
import { setFlash } from "sveltekit-flash-message/server";
import { getTokenPayload } from "pocketbase-sveltekit";

export const load = async ({ params }) => {
  // The reset token is a JWT carrying the account email. Expose it so the
  // page can render a hidden username field for password managers.
  const { email } = getTokenPayload(params.token);

  return {
    form: await superValidate(zod4(confirmResetSchema)),
    email: typeof email === "string" ? email : null,
  };
};

export const actions = {
  default: async ({ locals, request, params, cookies }) => {
    const form = await superValidate(request, zod4(confirmResetSchema));

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
