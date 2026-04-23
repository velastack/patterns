import Stripe from "stripe";
import { subscriptionRecordFields } from "./shared";

/**
 * Handles customer.subscription.created event
 */
export async function handleSubscriptionCreated(
  subscription: Stripe.Subscription,
  locals: App.Locals,
) {
  const fields = subscriptionRecordFields(subscription);
  if (!fields) return;

  const customer = await locals.admin
    .collection("stripe_customers")
    .getOne(fields.customer);

  await locals.admin.collection("stripe_subscriptions").create({
    ...fields,
    user: customer.user,
  });
}
