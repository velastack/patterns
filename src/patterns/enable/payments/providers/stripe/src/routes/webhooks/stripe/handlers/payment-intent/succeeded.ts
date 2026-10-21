import Stripe from "stripe";

/**
 * Handles payment_intent.succeeded event
 */
export async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  locals: App.Locals,
) {
  return {};
}
