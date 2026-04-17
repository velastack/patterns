import { fail, superValidate } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { resetSchema } from "$lib/schemas/reset";
import { redirect } from "@sveltejs/kit";
import { setFlash } from "sveltekit-flash-message/server";

export const load = async ({ locals }) => {
  if (locals.pb.authStore.isValid) {
    redirect(303, "/dashboard");
  }

  return { form: await superValidate(zod4(resetSchema)) };
};

export const actions = {
  default: async ({ locals, request, cookies }) => {
    const form = await superValidate(request, zod4(resetSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    await locals.pb.collection("users").requestPasswordReset(form.data.email);
    setFlash(
      {
        type: "toast",
        message: "We sent a password reset link to your email.",
      },
      cookies,
    );

    return { form };
  },
};
