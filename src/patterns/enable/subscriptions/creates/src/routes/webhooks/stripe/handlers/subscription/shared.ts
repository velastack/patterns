import Stripe from "stripe";

function unixToIso(unix: number | null | undefined): string | null {
  if (!unix) return null;
  return new Date(unix * 1000).toISOString();
}

/**
 * Extracts the subset of Stripe.Subscription fields that map to a
 * stripe_subscriptions row. Returns null if the subscription has no
 * price (shouldn't happen, but guard).
 *
 * `current_period_start`/`current_period_end` live on the subscription item
 * in API versions >= 2025-03-31 — read from there with a fallback to the
 * subscription-level field for older events.
 */
export function subscriptionRecordFields(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  const priceId = item?.price.id;
  if (!priceId) {
    console.error(`Subscription ${subscription.id} has no price`);
    return null;
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const itemPeriodStart = (item as unknown as { current_period_start?: number })
    .current_period_start;
  const itemPeriodEnd = (item as unknown as { current_period_end?: number })
    .current_period_end;
  const subPeriodStart = (
    subscription as unknown as { current_period_start?: number }
  ).current_period_start;
  const subPeriodEnd = (
    subscription as unknown as { current_period_end?: number }
  ).current_period_end;

  return {
    id: subscription.id,
    customer: customerId,
    price: priceId,
    status: subscription.status,
    current_period_start: unixToIso(itemPeriodStart ?? subPeriodStart),
    current_period_end: unixToIso(itemPeriodEnd ?? subPeriodEnd),
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: unixToIso(subscription.canceled_at),
  };
}
