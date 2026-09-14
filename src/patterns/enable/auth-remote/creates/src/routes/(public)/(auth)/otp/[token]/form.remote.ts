import { form, getRequestEvent } from "$app/server";
import { redirect } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { otpSchema } from "$lib/schemas/otp";

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

  const redirectUrl = url.searchParams.get("redirect") ?? "/dashboard";
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
