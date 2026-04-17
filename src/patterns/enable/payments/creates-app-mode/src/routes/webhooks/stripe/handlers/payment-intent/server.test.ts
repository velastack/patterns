import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type Stripe from "stripe";
import stripe from "$lib/stripe";
import { handlePaymentIntentSucceeded } from "./succeeded";

describe("payment_intent.succeeded", () => {
  let stripeCustomer: Stripe.Customer;
  let paymentIntent: Stripe.PaymentIntent;
  let paymentMethod: Stripe.PaymentMethod;

  beforeEach(async (context) => {
    // Create a Stripe customer
    stripeCustomer = await stripe.customers.create({
      email: context.user.email,
      metadata: {
        test: "true",
      },
    });

    // Link the Stripe customer to the test user
    await context.admin.collection("stripe_customers").create({
      id: stripeCustomer.id,
      user: context.user.id,
    });

    // Create a payment method for testing
    paymentMethod = await stripe.paymentMethods.create({
      type: "card",
      card: {
        token: "tok_visa",
      },
    });

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethod.id, {
      customer: stripeCustomer.id,
    });

    // Create a payment intent
    paymentIntent = await stripe.paymentIntents.create({
      amount: 2000, // $20.00
      currency: "usd",
      customer: stripeCustomer.id,
      payment_method: paymentMethod.id,
      confirm: true,
      return_url: "https://example.com/return",
    });
  });

  afterEach(async (context) => {
    // Clean up transactions
    const transactions = await context.admin
      .collection("transactions")
      .getFullList({
        filter: context.admin.filter("stripe_customer = {:stripeCustomer}", {
          stripeCustomer: stripeCustomer.id,
        }),
      });
    for (const transaction of transactions) {
      await context.admin.collection("transactions").delete(transaction.id);
    }

    // Clean up Stripe resources
    if (paymentMethod?.id) {
      try {
        await stripe.paymentMethods.detach(paymentMethod.id);
      } catch (e) {
        // Payment method may already be detached
      }
    }

    // Delete customer (this will also delete associated payment methods)
    if (stripeCustomer?.id) {
      await context.admin
        .collection("stripe_customers")
        .delete(stripeCustomer.id);
      await stripe.customers.del(stripeCustomer.id);
    }
  });

  it("creates a transaction record when payment intent succeeds", async (context) => {
    const locals = { admin: context.admin } as App.Locals;
    await handlePaymentIntentSucceeded(paymentIntent, locals);

    // Verify transaction was created
    const transactions = await context.admin
      .collection("transactions")
      .getFullList({
        filter: context.admin.filter(
          "stripe_payment_intent = {:paymentIntent}",
          {
            paymentIntent: paymentIntent.id,
          },
        ),
      });

    expect(transactions).toHaveLength(1);
    const transaction = transactions[0];

    expect(transaction.stripe_payment_intent).toBe(paymentIntent.id);
    expect(transaction.stripe_customer).toBe(stripeCustomer.id);
    expect(transaction.amount).toBe(2000);
    expect(transaction.currency).toBe("usd");
    expect(transaction.user).toBe(context.user.id);
    expect(transaction.stripe_charge).toBeDefined();
    expect(transaction.last4).toBeDefined();
    expect(transaction.brand).toBeDefined();
    expect(transaction.created).toBeDefined();
    expect(transaction.receipt_url).toBeDefined();
  });

  it("handles payment intent with charge object instead of string", async (context) => {
    // Retrieve the payment intent with expanded charge
    const expandedPaymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntent.id,
      {
        expand: ["latest_charge"],
      },
    );

    const locals = { admin: context.admin } as App.Locals;
    await handlePaymentIntentSucceeded(expandedPaymentIntent, locals);

    // Verify transaction was created
    const transactions = await context.admin
      .collection("transactions")
      .getFullList({
        filter: context.admin.filter(
          "stripe_payment_intent = {:paymentIntent}",
          {
            paymentIntent: paymentIntent.id,
          },
        ),
      });

    expect(transactions).toHaveLength(1);
    const transaction = transactions[0];

    expect(transaction.stripe_payment_intent).toBe(paymentIntent.id);
    expect(transaction.stripe_charge).toBeDefined();
  });

  it("handles payment intent with customer object instead of string", async (context) => {
    // Retrieve the payment intent with expanded customer
    const expandedPaymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntent.id,
      {
        expand: ["customer"],
      },
    );

    const locals = { admin: context.admin } as App.Locals;
    await handlePaymentIntentSucceeded(expandedPaymentIntent, locals);

    // Verify transaction was created
    const transactions = await context.admin
      .collection("transactions")
      .getFullList({
        filter: context.admin.filter(
          "stripe_payment_intent = {:paymentIntent}",
          {
            paymentIntent: paymentIntent.id,
          },
        ),
      });

    expect(transactions).toHaveLength(1);
    expect(transactions[0].stripe_customer).toBe(stripeCustomer.id);
  });

  it("handles missing charge ID gracefully", async (context) => {
    const paymentIntentWithoutCharge = {
      ...paymentIntent,
      latest_charge: null,
    } as Stripe.PaymentIntent;

    const locals = { admin: context.admin } as App.Locals;
    await handlePaymentIntentSucceeded(paymentIntentWithoutCharge, locals);

    // Verify no transaction was created
    const transactions = await context.admin
      .collection("transactions")
      .getFullList({
        filter: context.admin.filter(
          "stripe_payment_intent = {:paymentIntent}",
          {
            paymentIntent: paymentIntent.id,
          },
        ),
      });

    expect(transactions).toHaveLength(0);
  });

  it("handles missing customer ID gracefully", async (context) => {
    const paymentIntentWithoutCustomer = {
      ...paymentIntent,
      customer: null,
    } as Stripe.PaymentIntent;

    const locals = { admin: context.admin } as App.Locals;
    await handlePaymentIntentSucceeded(paymentIntentWithoutCustomer, locals);

    // Verify no transaction was created
    const transactions = await context.admin
      .collection("transactions")
      .getFullList({
        filter: context.admin.filter(
          "stripe_payment_intent = {:paymentIntent}",
          {
            paymentIntent: paymentIntent.id,
          },
        ),
      });

    expect(transactions).toHaveLength(0);
  });
});
