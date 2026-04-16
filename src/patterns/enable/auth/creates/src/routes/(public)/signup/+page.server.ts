import { redirect } from "@sveltejs/kit";
import { fail, superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { setFlash } from "sveltekit-flash-message/server";
import { setPocketbaseErrors } from "@velastack/pocketbase";
import { dev } from "$app/environment";
import { signupSchema } from "$lib/schemas/signup";

export const load = async ({ locals }) => {
  const authMethods = await locals.admin.collection("users").listAuthMethods();

  if (locals.pb.authStore.isValid) {
    redirect(303, "/dashboard");
  }

  return { form: await superValidate(zod(signupSchema)), authMethods };
};

export const actions = {
  default: async ({ locals, request, cookies, url }) => {
    const form = await superValidate(request, zod(signupSchema));

    if (!form.valid) {
      return fail(400, { form });
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

    await locals.pb.collection("users").requestVerification(user.email);
    await locals.pb
      .collection("users")
      .authWithPassword(form.data.email, form.data.password);

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
    return redirect(303, redirectUrl);
  },
};
