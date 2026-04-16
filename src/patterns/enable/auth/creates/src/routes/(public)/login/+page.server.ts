import { fail, superValidate, message } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { loginSchema } from "$lib/schemas/login";
import { redirect } from "@sveltejs/kit";
import { dev } from "$app/environment";

export const load = async ({ locals }) => {
  if (locals.pb.authStore.isValid) {
    redirect(303, "/dashboard");
  }

  const authMethods = await locals.admin.collection("users").listAuthMethods();

  const type: "password" | "otp" | "oauth2" = authMethods.otp.enabled
    ? "otp"
    : authMethods.password.enabled
      ? "password"
      : "oauth2";

  return {
    form: await superValidate(
      zod(loginSchema.default({ type, email: "", password: "" })),
    ),
    authMethods,
  };
};

export const actions = {
  default: async ({ locals, request, cookies, url }) => {
    const form = await superValidate(request, zod(loginSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    const redirectParam = url.searchParams.get("redirect");
    if (form.data.type === "otp") {
      const req = await locals.pb
        .collection("users")
        .requestOTP(form.data.email);
      return redirect(
        303,
        `/otp/${req.otpId}${redirectParam ? `?redirect=${encodeURIComponent(redirectParam)}` : ""}`,
      );
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
