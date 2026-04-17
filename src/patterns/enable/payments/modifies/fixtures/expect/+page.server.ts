import { redirect } from "@sveltejs/kit";
import { fail, superValidate } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { setFlash } from "sveltekit-flash-message/server";
import { setPocketbaseErrors } from "@velastack/pocketbase";
import { dev } from "$app/environment";
import { signupSchema } from "$lib/schemas/signup";
import stripe from "$lib/stripe";

export const load = async ({ locals }) => {
  const authMethods = await locals.admin.collection("users").listAuthMethods();

  if (locals.pb.authStore.isValid) {
    redirect(303, "/dashboard");
  }

  return { form: await superValidate(zod4(signupSchema)), authMethods };
};

export const actions = {
  default: async ({ locals, request, cookies, url }) => {
    const form = await superValidate(request, zod4(signupSchema));

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

    await linkStripeCustomer(form.data.email, user, locals);

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
const linkStripeCustomer = async (
  email: string,
  user: { id: string },
  locals: App.Locals,
) => {
  const matchingCustomer = await stripe.customers.list({
    email: email,
    limit: 1,
    expand: ["data.invoice_settings"],
  });

  let customer;
  let isExistingCustomer = false;

  if (matchingCustomer.data.length > 0) {
    isExistingCustomer = true;
    customer = matchingCustomer.data[0];
  } else {
    customer = await stripe.customers.create({
      email: email,
    });
  }

  await locals.admin.collection("stripe_customers").create({
    id: customer.id,
    user: user.id,
  });

  if (!isExistingCustomer) {
    return;
  }

  const paymentMethods = await stripe.customers.listPaymentMethods(
    customer.id,
    {
      type: "card",
      allow_redisplay: "always",
    },
  );

  for (const paymentMethod of paymentMethods.data) {
    if (paymentMethod.allow_redisplay === "unspecified") {
      continue;
    }

    await locals.admin.collection("stripe_payment_methods").create({
      id: paymentMethod.id,
      customer: customer.id,
      brand: paymentMethod.card?.brand,
      last4: paymentMethod.card?.last4,
      exp_month: paymentMethod.card?.exp_month,
      exp_year: paymentMethod.card?.exp_year,
    });
  }

  const defaultPaymentMethod =
    customer.invoice_settings?.default_payment_method;

  if (defaultPaymentMethod) {
    try {
      await locals.admin.collection("stripe_customers").update(customer.id, {
        default_payment_method: defaultPaymentMethod,
      });
    } catch {}
  }
};
