import { describe, it, expect, beforeAll } from "vitest";
import type { Match } from "@velastack/pocketbase";
import type { RouteId } from "./$types";
import stripe from "$lib/stripe";
import type Stripe from "stripe";

describe("POST /api/stripe/payment-intent", () => {
  let product: Stripe.Product;
  let activePrice: Stripe.Price;
  let inactivePrice: Stripe.Price;

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
});
