import { form, getRequestEvent } from "$app/server";
import { redirect } from "@sveltejs/kit";
import { setFlash } from "sveltekit-flash-message/server";
import { dev } from "$app/env";
import { signupSchema } from "#lib/schemas/signup.js";
import { requestWhatsAppOTP } from "#lib/server/whatsapp.js";

/** The first field error, or the response message, of a PocketBase error. */
function errorMessage(err: any, fallback: string): string {
  const response = err?.response ?? {};
  const fieldError = response?.data
    ? Object.values(response.data)[0]
    : undefined;
  return (fieldError as any)?.message ?? response?.message ?? fallback;
}

export const signupForm = form(signupSchema, async (data) => {
  const { locals, cookies, url } = getRequestEvent();

  // Follow only a same-site path (`/x`, not `//host` or `/\host`):
  // `redirect()` throws on an external URL.
  const next = url.searchParams.get("redirect");
  const redirectParam = next && /^\/(?![/\\])/.test(next) ? next : null;
  const redirectQuery = redirectParam
    ? `?redirect=${encodeURIComponent(redirectParam)}`
    : "";

  if (data.type === "whatsapp") {
    // The account is created when the code is checked.
    let otpId: string;
    try {
      ({ otpId } = await requestWhatsAppOTP(locals.pb, data.phone ?? ""));
    } catch (err: any) {
      return { message: errorMessage(err, "Failed to send the code.") };
    }
    redirect(303, `/whatsapp/${otpId}${redirectQuery}`);
  }

  const email = data.email ?? "";

  if (data.type === "otp") {
    // PocketBase only sends codes to existing accounts, so create it first,
    // with a password nobody knows (a reset sets a real one). Checking the
    // code marks the email verified.
    const password = crypto.randomUUID();
    try {
      await locals.admin.collection("users").create({
        email,
        password,
        passwordConfirm: password,
      });
    } catch (err: any) {
      // An existing account gets a code too, the same as logging in with one.
      if (err?.response?.data?.email?.code !== "validation_not_unique") {
        return { message: errorMessage(err, "Failed to create account.") };
      }
    }

    let otpId: string;
    try {
      ({ otpId } = await locals.pb.collection("users").requestOTP(email));
    } catch (err: any) {
      return { message: errorMessage(err, "Failed to send the code.") };
    }
    // A new account has no name yet: ask for one once the code checks out.
    const welcome = `/welcome${redirectQuery}`;
    redirect(303, `/otp/${otpId}?redirect=${encodeURIComponent(welcome)}`);
  }

  try {
    await locals.admin.collection("users").create({
      email,
      password: data.password,
      passwordConfirm: data.passwordConfirm,
    });
  } catch (err: any) {
    return { message: errorMessage(err, "Failed to create account.") };
  }

  await locals.pb.collection("users").requestVerification(email);
  await locals.pb
    .collection("users")
    .authWithPassword(email, data.password ?? "");

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
  redirect(303, redirectUrl);
});
