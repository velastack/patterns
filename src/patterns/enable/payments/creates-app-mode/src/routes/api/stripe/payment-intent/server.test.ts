import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import type { Match } from "@velastack/pocketbase";
import type { RouteId } from "./$types";
import stripe from "$lib/stripe";
import type Stripe from "stripe";

describe("POST /api/stripe/payment-intent", () => {
  let product: Stripe.Product;
  let activePrice: Stripe.Price;
  let inactivePrice: Stripe.Price;
  let stripeCustomer: Stripe.Customer;
  let paymentMethod: Stripe.PaymentMethod;

  beforeAll(async () => {
    const productName = "Test Product - Payment Intent";
    const products = await stripe.products.search({
      query: `name:"${productName}" AND metadata["test"]:"true"`,
      limit: 1,
    });

    if (products.data.length > 0) {
      product = products.data[0];

      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
        limit: 1,
      });

      if (prices.data.length > 0) {
        activePrice = prices.data[0];
      }

      const inactivePrices = await stripe.prices.list({
        product: product.id,
        active: false,
        limit: 1,
      });

      if (inactivePrices.data.length > 0) {
        inactivePrice = inactivePrices.data[0];
      }
    }

    // Create if not found or no active price
    if (!product) {
      product = await stripe.products.create({
        name: productName,
        metadata: {
          test: "true",
          test_type: "payment-intent",
        },
      });
    }

    if (!activePrice) {
      activePrice = await stripe.prices.create({
        product: product.id,
        unit_amount: 1000,
        currency: "usd",
        metadata: {
          test: "true",
          test_type: "payment-intent",
        },
      });
    }

    if (!inactivePrice) {
      inactivePrice = await stripe.prices.create({
        product: product.id,
        unit_amount: 2000,
        currency: "usd",
        active: false,
        metadata: {
          test: "true",
          test_type: "payment-intent-inactive",
        },
      });
    }
  });

  beforeEach(async (context) => {
    // Create a Stripe customer for authenticated user tests
    stripeCustomer = await stripe.customers.create({
      email: context.user.email,
      metadata: {
        test: "true",
      },
    });

    // Create a payment method for the customer
    paymentMethod = await stripe.paymentMethods.create({
      type: "card",
      card: {
        token: "tok_visa",
      },
    });

    await stripe.paymentMethods.attach(paymentMethod.id, {
      customer: stripeCustomer.id,
    });
  });

  afterEach(async () => {
    if (paymentMethod?.id) {
      await stripe.paymentMethods.detach(paymentMethod.id);
    }

    if (stripeCustomer?.id) {
      await stripe.customers.del(stripeCustomer.id);
    }
  });

  describe("Request validation", () => {
    it("should return 400 if request body is not valid JSON", async (context) => {
      const response = await context.agent
        .post("/api/stripe/payment-intent" satisfies Match<RouteId>)
        .set("Content-Type", "application/json")
        .send("invalid json");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid request body");
    });

    it("should return 400 if priceId is missing", async (context) => {
      const response = await context.agent
        .post("/api/stripe/payment-intent" satisfies Match<RouteId>)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Price ID is required");
    });

    it("should return 400 if priceId is not a string", async (context) => {
      const response = await context.agent
        .post("/api/stripe/payment-intent" satisfies Match<RouteId>)
        .send({ priceId: 12345 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Price ID is required");
    });

    it("should return 400 if priceId is an empty string", async (context) => {
      const response = await context.agent
        .post("/api/stripe/payment-intent" satisfies Match<RouteId>)
        .send({ priceId: "" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Price ID is required");
    });

    it("should return 404 if price does not exist", async (context) => {
      const response = await context.agent
        .post("/api/stripe/payment-intent" satisfies Match<RouteId>)
        .send({ priceId: "price_nonexistent123" });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Invalid price ID or price not found");
    });

    it("should return 400 if price is not active", async (context) => {
      const response = await context.agent
        .post("/api/stripe/payment-intent" satisfies Match<RouteId>)
        .send({ priceId: inactivePrice.id });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("This price is no longer available");
    });
  });

  describe("Guest user (unauthenticated)", () => {
    it("should create payment intent for guest user", async (context) => {
      const response = await context.request
        .post("/api/stripe/payment-intent" satisfies Match<RouteId>)
        .send({ priceId: activePrice.id });

      expect(response.status).toBe(200);
      expect(response.body.type).toBe("payment");
      expect(response.body.clientSecret).toBeDefined();
      expect(response.body.amount).toBe(1000);
      expect(response.body.currency).toBe("usd");
      expect(response.body.brand).toBeUndefined();
      expect(response.body.last4).toBeUndefined();

      // Verify the payment intent was created in Stripe
      const intentId = response.body.clientSecret.split("_secret_")[0];
      const intent = await stripe.paymentIntents.retrieve(intentId);
      expect(intent.amount).toBe(1000);
      expect(intent.currency).toBe("usd");
      expect(intent.customer).toBeNull();

      // Clean up
      await stripe.paymentIntents.cancel(intent.id);
    });
  });

  describe("Authenticated user without Stripe customer", () => {
    it("should create payment intent for user without Stripe customer", async (context) => {
      await context.agent.authenticateUser();

      const response = await context.agent
        .post("/api/stripe/payment-intent" satisfies Match<RouteId>)
        .send({ priceId: activePrice.id });

      expect(response.status).toBe(200);
      expect(response.body.type).toBe("payment");
      expect(response.body.clientSecret).toBeDefined();
      expect(response.body.amount).toBe(1000);
      expect(response.body.currency).toBe("usd");

      // Verify the payment intent
      const intentId = response.body.clientSecret.split("_secret_")[0];
      const intent = await stripe.paymentIntents.retrieve(intentId);
      expect(intent.amount).toBe(1000);
      expect(intent.setup_future_usage).toBeNull();

      // Clean up
      await stripe.paymentIntents.cancel(intent.id);
    });
  });

  describe("Authenticated user with Stripe customer", () => {
    let customerRecord: { id: string };

    beforeEach(async (context) => {
      // Link the Stripe customer to the PocketBase user
      customerRecord = await context.admin
        .collection("stripe_customers")
        .create({
          user: context.user.id,
          id: stripeCustomer.id,
          email: stripeCustomer.email,
        });
    });

    afterEach(async (context) => {
      // Clean up the PocketBase customer record
      await context.admin
        .collection("stripe_customers")
        .delete(customerRecord.id);
    });

    it("should create payment intent with setup_future_usage for user without default payment method", async (context) => {
      await context.agent.authenticateUser();

      const response = await context.agent
        .post("/api/stripe/payment-intent" satisfies Match<RouteId>)
        .send({ priceId: activePrice.id });

      expect(response.status).toBe(200);
      expect(response.body.type).toBe("payment");
      expect(response.body.clientSecret).toBeDefined();
      expect(response.body.amount).toBe(1000);
      expect(response.body.currency).toBe("usd");
      expect(response.body.brand).toBeUndefined();
      expect(response.body.last4).toBeUndefined();

      // Verify the payment intent has setup_future_usage
      const intentId = response.body.clientSecret.split("_secret_")[0];
      const intent = await stripe.paymentIntents.retrieve(intentId);
      expect(intent.customer).toBe(stripeCustomer.id);
      expect(intent.setup_future_usage).toBe("off_session");

      // Clean up
      await stripe.paymentIntents.cancel(intent.id);
    });

    it("should create payment intent with default payment method for customer with saved payment method", async (context) => {
      // Set default payment method
      await stripe.customers.update(stripeCustomer.id, {
        invoice_settings: {
          default_payment_method: paymentMethod.id,
        },
      });

      const customerRecord = await context.admin
        .collection("stripe_customers")
        .getFirstListItem(
          context.admin.filter("user = {:user}", { user: context.user.id }),
        );

      await context.admin.collection("stripe_payment_methods").create({
        id: paymentMethod.id,
        customer: customerRecord.id,
        brand: paymentMethod.card?.brand,
        last4: paymentMethod.card?.last4,
        exp_month: paymentMethod.card?.exp_month,
        exp_year: paymentMethod.card?.exp_year,
      });

      await context.admin
        .collection("stripe_customers")
        .update(customerRecord.id, {
          default_payment_method: paymentMethod.id,
        });

      await context.agent.authenticateUser();

      const response = await context.agent
        .post("/api/stripe/payment-intent" satisfies Match<RouteId>)
        .send({ priceId: activePrice.id });

      expect(response.status).toBe(200);
      expect(response.body.type).toBe("confirm");
      expect(response.body.clientSecret).toBeDefined();
      expect(response.body.amount).toBe(1000);
      expect(response.body.currency).toBe("usd");
      expect(response.body.brand).toBe("visa");
      expect(response.body.last4).toBeDefined();
      expect(response.body.last4).toMatch(/^\d{4}$/);

      // Verify the payment intent has the payment method attached
      const intentId = response.body.clientSecret.split("_secret_")[0];
      const intent = await stripe.paymentIntents.retrieve(intentId);
      expect(intent.customer).toBe(stripeCustomer.id);
      expect(intent.payment_method).toBe(paymentMethod.id);

      // Clean up
      await stripe.paymentIntents.cancel(intent.id);
    });
  });
});
