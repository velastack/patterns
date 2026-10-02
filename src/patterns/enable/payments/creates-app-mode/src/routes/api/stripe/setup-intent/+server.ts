import stripe from "#lib/stripe.js";

export const POST = async ({ locals }) => {
  const user = locals.pb.authStore.record?.id;

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customer = await locals.admin
    .collection("stripe_customers")
    .getFirstListItem(locals.admin.filter("user = {:user}", { user }));

  if (!customer) {
    return Response.json({ error: "Customer not found" }, { status: 404 });
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: customer.id,
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: "never",
    },
  });

  return Response.json({ clientSecret: setupIntent.client_secret });
};
