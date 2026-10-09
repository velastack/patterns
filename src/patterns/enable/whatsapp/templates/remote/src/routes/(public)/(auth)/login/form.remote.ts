import { form, getRequestEvent } from "$app/server";
import { redirect } from "@sveltejs/kit";
import { dev } from "$app/env";
import { loginSchema } from "#lib/schemas/login.js";
import { requestWhatsAppOTP } from "#lib/server/whatsapp.js";

export const loginForm = form(loginSchema, async (data) => {
  const { locals, cookies, url } = getRequestEvent();

  // Follow only a same-site path (`/x`, not `//host` or `/\host`):
  // `redirect()` throws on an external URL.
  const next = url.searchParams.get("redirect");
  const redirectParam = next && /^\/(?![/\\])/.test(next) ? next : null;
  const redirectQuery = redirectParam
    ? `?redirect=${encodeURIComponent(redirectParam)}`
    : "";
  if (data.type === "otp") {
    const req = await locals.pb
      .collection("users")
      .requestOTP(data.email ?? "");
    redirect(303, `/otp/${req.otpId}${redirectQuery}`);
  } else if (data.type === "whatsapp") {
    let otpId: string;
    try {
      ({ otpId } = await requestWhatsAppOTP(locals.pb, data.phone ?? ""));
    } catch (err: any) {
      // An invalid number comes back as a field error, the rest (WhatsApp
      // auth disabled, rate limited) as the response message.
      const response = err?.response ?? {};
      const fieldError = response?.data
        ? Object.values(response.data)[0]
        : undefined;
      const message: string =
        (fieldError as any)?.message ??
        response?.message ??
        "Failed to send the code.";
      return { message };
    }
    redirect(303, `/whatsapp/${otpId}${redirectQuery}`);
  } else if (data.type === "password") {
    try {
      await locals.pb
        .collection("users")
        .authWithPassword(data.email ?? "", data.password ?? "");
    } catch (err: any) {
      return {
        message: (err.response?.message as string) ?? "Failed to authenticate.",
      };
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
