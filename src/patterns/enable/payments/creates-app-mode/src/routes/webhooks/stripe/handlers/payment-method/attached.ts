import Stripe from "stripe";
import stripe from "$lib/stripe";

/**
 * Handles payment_method.attached event
 */
export async function handlePaymentMethodAttached(
  paymentMethod: Stripe.PaymentMethod,
  locals: App.Locals,
) {
  if (
    paymentMethod.allow_redisplay === "unspecified" ||
    !paymentMethod.customer
  ) {
    return;
  }

  const customer =
    typeof paymentMethod.customer === "string"
      ? paymentMethod.customer
      : paymentMethod.customer?.id;

  await locals.admin.collection("stripe_payment_methods").create({
    id: paymentMethod.id,
    customer: customer,
    brand: paymentMethod.card?.brand,
    last4: paymentMethod.card?.last4,
    exp_month: paymentMethod.card?.exp_month,
    exp_year: paymentMethod.card?.exp_year,
  });

  const paymentMethodRecords = await locals.admin
    .collection("stripe_payment_methods")
    .getFullList({
      filter: locals.admin.filter("customer = {:customer}", {
        customer: customer,
      }),
    });

  if (paymentMethodRecords.length === 1) {
    const paymentMethod = paymentMethodRecords[0];

    await stripe.customers.update(customer, {
      invoice_settings: {
        default_payment_method: paymentMethod.id,
      },
    });

    await locals.admin.collection("stripe_customers").update(customer, {
      default_payment_method: paymentMethod.id,
    });
  }
}
