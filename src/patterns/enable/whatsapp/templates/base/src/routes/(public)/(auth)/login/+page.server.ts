import { fail, superValidate, message } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { setPocketbaseErrors } from "@velastack/pocketbase/form";
import { loginSchema } from "#lib/schemas/login.js";
import {
  requestWhatsAppOTP,
  whatsappAuthMethod,
} from "#lib/server/whatsapp.js";
import { redirect } from "@sveltejs/kit";
import { dev } from "$app/env";

export const load = async ({ locals }) => {
  if (locals.pb.authStore.isValid) {
    redirect(303, "/dashboard");
  }

  const authMethods = await locals.admin.collection("users").listAuthMethods();
  const whatsapp = whatsappAuthMethod(authMethods);

  const type: "password" | "otp" | "oauth2" | "whatsapp" = authMethods.otp
    .enabled
    ? "otp"
    : authMethods.password.enabled
      ? "password"
      : whatsapp.enabled
        ? "whatsapp"
        : "oauth2";

  return {
    form: await superValidate(
      zod4(
        loginSchema.default({ type, email: "", password: "", phone: "" }),
      ),
    ),
    authMethods,
    whatsapp,
  };
};

export const actions = {
  default: async ({ locals, request, cookies, url }) => {
    const form = await superValidate(request, zod4(loginSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    // Follow only a same-site path (`/x`, not `//host` or `/\host`):
    // `redirect()` throws on an external URL.
    const next = url.searchParams.get("redirect");
    const redirectParam = next && /^\/(?![/\\])/.test(next) ? next : null;
    const redirectQuery = redirectParam
      ? `?redirect=${encodeURIComponent(redirectParam)}`
      : "";
    if (form.data.type === "otp") {
      const req = await locals.pb
        .collection("users")
        .requestOTP(form.data.email);
      return redirect(303, `/otp/${req.otpId}${redirectQuery}`);
    } else if (form.data.type === "whatsapp") {
      let otpId: string;
      try {
        ({ otpId } = await requestWhatsAppOTP(locals.pb, form.data.phone));
      } catch (error: any) {
        // An invalid number goes on the field; the rest (WhatsApp auth
        // disabled, rate limited) on the form.
        if (Object.keys(error.response?.data ?? {}).length) {
          setPocketbaseErrors(form, error);
          return fail(400, { form });
        }
        return message(
          form,
          {
            type: "error",
            text: error.response?.message ?? "Failed to send the code.",
          },
          { status: 400 },
        );
      }
      return redirect(303, `/whatsapp/${otpId}${redirectQuery}`);
    } else if (form.data.type === "password") {
      try {
        await locals.pb
          .collection("users")
          .authWithPassword(form.data.email, form.data.password);
      } catch (error: any) {
        return message(
          form,
          { type: "error", text: error.response.message },
          { status: 400 },
        );
      }
    }

    const redirectUrl = redirectParam ?? "/dashboard";
    const cookie = locals.pb.authStore.getCookie();
    cookies.set("pb_auth", cookie, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: !dev,
      maxAge: 60 * 60 * 24 * 30,
    });

    redirect(303, redirectUrl);
  },
};
