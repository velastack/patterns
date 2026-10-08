import stripe from "#lib/stripe.js";
import { getStripeCustomerId } from "#lib/server/stripe-customer.js";

export const POST = async ({ locals }) => {
  const user = locals.pb.authStore.record;

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let customer: string;
  try {
    customer = await getStripeCustomerId(locals.admin, user);
  } catch {
    return Response.json(
      { error: "Billing is still being set up. Try again shortly." },
      { status: 503 },
    );
  }

  const setupIntent = await stripe.setupIntents.create({
    customer,
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: "never",
    },
  });

  return Response.json({ clientSecret: setupIntent.client_secret });
};
