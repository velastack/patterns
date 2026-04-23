import { json } from "@sveltejs/kit";
import stripe from "$lib/stripe";
import { INTERNAL_JOB_SECRET } from "$env/static/private";
import { subscriptionRecordFields } from "../../../../webhooks/stripe/handlers/subscription/shared";

export const POST = async ({ request, locals }) => {
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${INTERNAL_JOB_SECRET}`) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscriptions = await stripe.subscriptions.list({
    status: "all",
    limit: 100,
  });

  for (const subscription of subscriptions.data) {
    const fields = subscriptionRecordFields(subscription);
    if (!fields) continue;

    let customer;
    try {
      customer = await locals.admin
        .collection("stripe_customers")
        .getOne(fields.customer);
    } catch {
      console.log(
        `Skipping subscription ${subscription.id}: customer ${fields.customer} not found locally`,
      );
      continue;
    }

    try {
      await locals.admin
        .collection("stripe_subscriptions")
        .update(subscription.id, fields);
    } catch {
      await locals.admin.collection("stripe_subscriptions").create({
        ...fields,
        user: customer.user,
      });
    }
  }

  console.log("Subscriptions synced");
  return json({ message: "Subscriptions synced" });
};
