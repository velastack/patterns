import Stripe from "stripe";
import { subscriptionRecordFields } from "./shared";

/**
 * Handles customer.subscription.updated event
 */
export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  locals: App.Locals,
) {
  const fields = subscriptionRecordFields(subscription);
  if (!fields) return;

  try {
    await locals.admin
      .collection("stripe_subscriptions")
      .update(subscription.id, fields);
  } catch {
    // Row may not exist if the created event was missed; upsert instead.
    const customer = await locals.admin
      .collection("stripe_customers")
      .getOne(fields.customer);

    await locals.admin.collection("stripe_subscriptions").create({
      ...fields,
      user: customer.user,
    });
  }
}
