import Stripe from "stripe";
import { subscriptionRecordFields } from "./shared";

/**
 * Handles customer.subscription.deleted event
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  locals: App.Locals,
) {
  const fields = subscriptionRecordFields(subscription);
  if (!fields) return;

  try {
    await locals.admin
      .collection("stripe_subscriptions")
      .update(subscription.id, {
        ...fields,
        status: "canceled",
        canceled_at: fields.canceled_at ?? new Date().toISOString(),
      });
  } catch {
    // Row may not exist; ignore.
    console.log(`Subscription ${subscription.id} not found for deletion`);
  }
}
