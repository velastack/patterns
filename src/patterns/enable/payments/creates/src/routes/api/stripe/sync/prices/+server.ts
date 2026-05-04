import { json } from "@sveltejs/kit";
import stripe from "$lib/stripe";
import { env } from "$env/dynamic/private";

export const POST = async ({ request, locals }) => {
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${env.INTERNAL_JOB_SECRET}`) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const prices = await stripe.prices.list();

  for (const price of prices.data) {
    try {
      await locals.admin
        .collection("stripe_prices")
        .getFirstListItem(`id = "${price.id}"`);
      continue;
    } catch {}

    await locals.admin.collection("stripe_prices").create({
      id: price.id,
      billing_scheme: price.billing_scheme,
      currency: price.currency,
      product: price.product,
      recurring: price.recurring,
      type: price.type,
      unit_amount: price.unit_amount,
      active: price.active,
    });
  }

  console.log("Prices synced");
  return json({ message: "Prices synced" });
};
