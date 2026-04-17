import { json } from "@sveltejs/kit";
import stripe from "$lib/stripe";

export const POST = async ({ locals }) => {
  const user = locals.pb.authStore.record?.id;

  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const customer = await locals.admin
    .collection("stripe_customers")
    .getFirstListItem(locals.admin.filter("user = {:user}", { user }));

  if (!customer) {
    return json({ error: "Customer not found" }, { status: 404 });
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: customer.id,
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: "never",
    },
  });

  return json({ clientSecret: setupIntent.client_secret });
};
