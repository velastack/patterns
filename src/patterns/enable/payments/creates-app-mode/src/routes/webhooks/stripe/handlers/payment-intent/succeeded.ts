import Stripe from "stripe";
import stripe from "$lib/stripe";
/**
 * Handles payment_intent.succeeded event
 */
export async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  locals: App.Locals,
) {
  const chargeId =
    typeof paymentIntent.latest_charge === "string"
      ? paymentIntent.latest_charge
      : paymentIntent.latest_charge?.id;

  if (!chargeId) {
    console.error("No charge ID found for payment intent");
    return;
  }

  const charge = await stripe.charges.retrieve(chargeId);

  const customerId =
    typeof paymentIntent.customer === "string"
      ? paymentIntent.customer
      : paymentIntent.customer?.id;

  if (!customerId) {
    console.error("No customer ID found for payment intent");
    return;
  }

  const customer = await locals.admin
    .collection("stripe_customers")
    .getOne(customerId);
  const created = new Date(charge.created * 1000);

  await locals.admin.collection("transactions").create({
    stripe_payment_intent: paymentIntent.id,
    stripe_charge: chargeId,
    stripe_customer: customerId,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    created: created.toISOString(),
    last4: charge.payment_method_details?.card?.last4,
    brand: charge.payment_method_details?.card?.brand,
    receipt_url: charge.receipt_url,
    user: customer.user,
  });
}
