import { describe, it, expect } from "vitest";
import stripe from "$lib/stripe";
import { handlePaymentIntentSucceeded } from "./succeeded";

describe("payment_intent.succeeded", () => {
  it("handles a payment intent successfully", async (context) => {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 2000,
      currency: "usd",
    });
    const locals = { admin: context.admin } as App.Locals;
    const result = await handlePaymentIntentSucceeded(paymentIntent, locals);

    expect(result).toEqual({});
  });
});
