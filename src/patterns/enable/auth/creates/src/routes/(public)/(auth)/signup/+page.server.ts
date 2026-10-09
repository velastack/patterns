import { redirect } from "@sveltejs/kit";
import { fail, message, superValidate } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { setFlash } from "sveltekit-flash-message/server";
import { setPocketbaseErrors } from "@velastack/pocketbase/form";
import { dev } from "$app/env";
import { signupSchema } from "#lib/schemas/signup.js";

export const load = async ({ locals }) => {
  const authMethods = await locals.admin.collection("users").listAuthMethods();

  if (locals.pb.authStore.isValid) {
    redirect(303, "/dashboard");
  }

  const type: "password" | "otp" =
    !authMethods.password.enabled && authMethods.otp.enabled
      ? "otp"
      : "password";

  return {
    form: await superValidate(
      zod4(
        signupSchema.default({
          type,
          email: "",
          password: "",
          passwordConfirm: "",
        }),
      ),
    ),
    authMethods,
  };
};

export const actions = {
  default: async ({ locals, request, cookies, url }) => {
    const form = await superValidate(request, zod4(signupSchema));

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
      // PocketBase only sends codes to existing accounts, so create it first,
      // with a password nobody knows (a reset sets a real one). Checking the
      // code marks the email verified.
      const password = crypto.randomUUID();
      try {
        await locals.admin.collection("users").create({
          email: form.data.email,
          password,
          passwordConfirm: password,
        });
      } catch (error: any) {
        // An existing account gets a code too, the same as logging in with one.
        if (error.response?.data?.email?.code !== "validation_not_unique") {
          setPocketbaseErrors(form, error);
          return fail(400, { form });
        }
      }

      let otpId: string;
      try {
        ({ otpId } = await locals.pb
          .collection("users")
          .requestOTP(form.data.email));
      } catch (error: any) {
        return message(
          form,
          {
            type: "error",
            text: error.response?.message ?? "Failed to send the code.",
          },
          { status: 400 },
        );
      }
      // A new account has no name yet: ask for one once the code checks out.
      const welcome = `/welcome${redirectQuery}`;
      return redirect(
        303,
        `/otp/${otpId}?redirect=${encodeURIComponent(welcome)}`,
      );
    }

    let user;

    try {
      user = await locals.admin.collection("users").create({
        email: form.data.email,
        password: form.data.password,
        passwordConfirm: form.data.passwordConfirm,
      });
    } catch (error) {
      setPocketbaseErrors(form, error);
      return fail(400, { form });
    }

    await locals.pb.collection("users").requestVerification(user.email!);
    await locals.pb
      .collection("users")
      .authWithPassword(form.data.email, form.data.password);

    const redirectUrl = redirectParam ?? "/dashboard";
    const cookie = locals.pb.authStore.getCookie();
    cookies.set("pb_auth", cookie, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: !dev,
      maxAge: 60 * 60 * 24 * 30,
    });

    setFlash(
      { type: "toast", message: "We sent a confirmation link to your email." },
      cookies,
    );
    return redirect(303, redirectUrl);
  },
};
