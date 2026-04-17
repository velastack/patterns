import { json } from "@sveltejs/kit";
import stripe from "$lib/stripe";
import { INTERNAL_JOB_SECRET } from "$env/static/private";

// Sync users to Stripe customers
export const POST = async ({ request, locals }) => {
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${INTERNAL_JOB_SECRET}`) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ensure all users have a Stripe customer
  const users = await locals.admin
    .collection("users")
    .getFullList({ filter: "stripe_customers_via_user.id = null" });

  for (const user of users) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
    });

    await locals.admin.collection("stripe_customers").create({
      id: customer.id,
      user: user.id,
    });
  }

  console.log("Customers synced");
  return json({ message: "Customers synced" });
};
