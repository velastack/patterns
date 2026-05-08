import { form, getRequestEvent } from "$app/server";
import { error, redirect } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { loginSchema } from "$lib/schemas/login";

export const loginForm = form(loginSchema, async (data) => {
  const { locals, cookies, url } = getRequestEvent();

  const redirectParam = url.searchParams.get("redirect");
  if (data.type === "otp") {
    const req = await locals.pb.collection("users").requestOTP(data.email);
    redirect(
      303,
      `/otp/${req.otpId}${redirectParam ? `?redirect=${encodeURIComponent(redirectParam)}` : ""}`,
    );
  } else if (data.type === "password") {
    try {
      await locals.pb
        .collection("users")
        .authWithPassword(data.email, data.password);
    } catch (err: any) {
      error(400, err.response?.message ?? "Failed to authenticate.");
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
});
