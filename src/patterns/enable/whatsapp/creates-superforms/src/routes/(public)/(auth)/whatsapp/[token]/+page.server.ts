import { fail, message, superValidate } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { otpSchema } from "#lib/schemas/otp.js";
import { authWithWhatsApp } from "#lib/server/whatsapp.js";
import { redirect } from "@sveltejs/kit";
import { dev } from "$app/env";

export const load = async ({ locals }) => {
  if (locals.pb.authStore.isValid) {
    redirect(303, "/dashboard");
  }

  return { form: await superValidate(zod4(otpSchema)) };
};

export const actions = {
  default: async ({ locals, request, params, cookies, url }) => {
    const form = await superValidate(request, zod4(otpSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    let isNew: boolean;
    try {
      // `isNew` is true when this code created the account.
      ({ isNew } = await authWithWhatsApp(
        locals.pb,
        params.token,
        form.data.otp,
      ));
    } catch (error: any) {
      return message(
        form,
        {
          type: "error",
          text: error.response?.message ?? "Failed to verify the code.",
        },
        { status: 400 },
      );
    }

    // Follow only a same-site path (`/x`, not `//host` or `/\host`):
    // `redirect()` throws on an external URL.
    const next = url.searchParams.get("redirect");
    const redirectUrl =
      next && /^\/(?![/\\])/.test(next) ? next : "/dashboard";
    const cookie = locals.pb.authStore.getCookie();
    cookies.set("pb_auth", cookie, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: !dev,
      maxAge: 60 * 60 * 24 * 30,
    });

    // A new account has only the phone number: ask for a name first.
    redirect(
      303,
      isNew
        ? `/welcome?redirect=${encodeURIComponent(redirectUrl)}`
        : redirectUrl,
    );
  },
};
