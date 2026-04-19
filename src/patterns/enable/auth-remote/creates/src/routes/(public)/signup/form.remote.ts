import { form, getRequestEvent } from "$app/server";
import { error, redirect } from "@sveltejs/kit";
import { setFlash } from "sveltekit-flash-message/server";
import { dev } from "$app/environment";
import { signupSchema } from "$lib/schemas/signup";

export const signupForm = form(signupSchema, async (data) => {
  const { locals, cookies, url } = getRequestEvent();

  let user;

  try {
    user = await locals.admin.collection("users").create({
      email: data.email,
      password: data.password,
      passwordConfirm: data.passwordConfirm,
    });
  } catch (err: any) {
    const response = err?.response ?? {};
    const fieldError = response?.data
      ? Object.values(response.data)[0]
      : undefined;
    const message =
      (fieldError as any)?.message ??
      response?.message ??
      "Failed to create account.";
    error(400, message);
  }

  await locals.pb.collection("users").requestVerification(user.email);
  await locals.pb
    .collection("users")
    .authWithPassword(data.email, data.password);

  const redirectUrl = url.searchParams.get("redirect") ?? "/dashboard";
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
