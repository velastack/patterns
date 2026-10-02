import { form, getRequestEvent } from "$app/server";
import { redirect } from "@sveltejs/kit";
import { dev } from "$app/env";
import { otpSchema } from "#lib/schemas/otp.js";

export const otpForm = form(otpSchema, async (data) => {
  const { locals, cookies, params, url } = getRequestEvent();

  try {
    await locals.pb
      .collection("users")
      .authWithOTP(params.token as string, data.otp);
  } catch (err: any) {
    return {
      message: (err.response?.message as string) ?? "Failed to verify code.",
    };
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

  redirect(303, redirectUrl);
});
