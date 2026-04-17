import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type Stripe from "stripe";
import stripe from "$lib/stripe";
import { handlePaymentMethodAttached } from "./attached";

describe("payment_method.attached", () => {
  let stripeCustomer: Stripe.Customer;
  let paymentMethod: Stripe.PaymentMethod;

  beforeEach(async (context) => {
    stripeCustomer = await stripe.customers.create({
      email: context.user.email,
      metadata: {
        test: "true",
      },
    });

    await context.admin.collection("stripe_customers").create({
      id: stripeCustomer.id,
      user: context.user.id,
    });

    paymentMethod = await stripe.paymentMethods.create({
      type: "card",
      card: {
        token: "tok_visa",
      },
    });

    await stripe.paymentMethods.attach(paymentMethod.id, {
      customer: stripeCustomer.id,
    });

    paymentMethod = await stripe.paymentMethods.update(paymentMethod.id, {
      allow_redisplay: "always",
    });
  });

  afterEach(async (context) => {
    const paymentMethods = await context.admin
      .collection("stripe_payment_methods")
      .getFullList({
        filter: context.admin.filter("customer = {:stripeCustomer}", {
          stripeCustomer: stripeCustomer.id,
        }),
      });

    for (const pm of paymentMethods) {
      await context.admin.collection("stripe_payment_methods").delete(pm.id);
    }

    if (paymentMethod?.id) {
      try {
        await stripe.paymentMethods.detach(paymentMethod.id);
      } catch {}
    }

    if (stripeCustomer?.id) {
      await context.admin
        .collection("stripe_customers")
        .delete(stripeCustomer.id);
      await stripe.customers.del(stripeCustomer.id);
    }
  });

  it("creates a payment method record when payment method is attached", async (context) => {
    const locals = { admin: context.admin } as App.Locals;
    await handlePaymentMethodAttached(paymentMethod, locals);

    // Verify payment method was created
    const paymentMethods = await context.admin
      .collection("stripe_payment_methods")
      .getFullList({
        filter: context.admin.filter("id = {:paymentMethod}", {
          paymentMethod: paymentMethod.id,
        }),
      });

    expect(paymentMethods).toHaveLength(1);
    const pm = paymentMethods[0];

    expect(pm.id).toBe(paymentMethod.id);
    expect(pm.customer).toBe(stripeCustomer.id);
    expect(pm.brand).toBe(paymentMethod.card?.brand);
    expect(pm.last4).toBe(paymentMethod.card?.last4);
    expect(pm.exp_month).toBe(paymentMethod.card?.exp_month);
    expect(pm.exp_year).toBe(paymentMethod.card?.exp_year);
  });

  it("sets payment method as default when it is the first one", async (context) => {
    const locals = { admin: context.admin } as App.Locals;
    await handlePaymentMethodAttached(paymentMethod, locals);

    // Verify it was set as default in database
    const customer = await context.admin
      .collection("stripe_customers")
      .getOne(stripeCustomer.id);
    expect(customer.default_payment_method).toBe(paymentMethod.id);

    // Verify it was set as default in Stripe
    const stripeCustomerUpdated = await stripe.customers.retrieve(
      stripeCustomer.id,
    );
    if ("deleted" in stripeCustomerUpdated) {
      throw new Error("Customer should not be deleted");
    }
    expect(stripeCustomerUpdated.invoice_settings.default_payment_method).toBe(
      paymentMethod.id,
    );
  });

  it("does not set as default when there are already payment methods", async (context) => {
    // Handle the first payment method
    const locals = { admin: context.admin } as App.Locals;
    await handlePaymentMethodAttached(paymentMethod, locals);

    // Verify it was set as default
    let customer = await context.admin
      .collection("stripe_customers")
      .getOne(stripeCustomer.id);
    expect(customer.default_payment_method).toBe(paymentMethod.id);

    // Create and attach a first payment method
    let secondPaymentMethod = await stripe.paymentMethods.create({
      type: "card",
      card: {
        token: "tok_mastercard",
      },
    });

    await stripe.paymentMethods.attach(secondPaymentMethod.id, {
      customer: stripeCustomer.id,
    });

    secondPaymentMethod = await stripe.paymentMethods.update(
      secondPaymentMethod.id,
      {
        allow_redisplay: "always",
      },
    );

    // Now handle the second payment method
    await handlePaymentMethodAttached(secondPaymentMethod, locals);

    // Verify the default did NOT change
    customer = await context.admin
      .collection("stripe_customers")
      .getOne(stripeCustomer.id);
    expect(customer.default_payment_method).toBe(paymentMethod.id);

    // Clean up the second payment method
    await context.admin
      .collection("stripe_payment_methods")
      .delete(secondPaymentMethod.id);
    await stripe.paymentMethods.detach(secondPaymentMethod.id);
  });

  it("handles payment method with customer object instead of string", async (context) => {
    // Retrieve the payment method with expanded customer
    const expandedPaymentMethod = await stripe.paymentMethods.retrieve(
      paymentMethod.id,
      {
        expand: ["customer"],
      },
    );

    const locals = { admin: context.admin } as App.Locals;
    await handlePaymentMethodAttached(expandedPaymentMethod, locals);

    // Verify payment method was created
    const paymentMethods = await context.admin
      .collection("stripe_payment_methods")
      .getFullList({
        filter: context.admin.filter("id = {:paymentMethod}", {
          paymentMethod: paymentMethod.id,
        }),
      });

    expect(paymentMethods).toHaveLength(1);
    expect(paymentMethods[0].customer).toBe(stripeCustomer.id);
  });

  it("does not create record when allow_redisplay is unspecified", async (context) => {
    // Update payment method to have unspecified allow_redisplay
    const unspecifiedPaymentMethod = await stripe.paymentMethods.update(
      paymentMethod.id,
      {
        allow_redisplay: "unspecified",
      },
    );

    const locals = { admin: context.admin } as App.Locals;
    await handlePaymentMethodAttached(unspecifiedPaymentMethod, locals);

    // Verify no payment method was created
    const paymentMethods = await context.admin
      .collection("stripe_payment_methods")
      .getFullList({
        filter: context.admin.filter("id = {:paymentMethod}", {
          paymentMethod: paymentMethod.id,
        }),
      });

    expect(paymentMethods).toHaveLength(0);
  });
});
