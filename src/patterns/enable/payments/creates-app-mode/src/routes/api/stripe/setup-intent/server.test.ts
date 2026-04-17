import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Match } from "@velastack/pocketbase";
import type Stripe from "stripe";
import stripe from "$lib/stripe";
import type { RouteId } from "./$types";

describe("POST /api/stripe/setup-intent", () => {
  let stripeCustomer: Stripe.Customer;

  beforeEach(async (context) => {
    await context.agent.authenticateUser();

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
  });

  afterEach(async (context) => {
    await context.admin
      .collection("stripe_customers")
      .delete(stripeCustomer.id);
  });

  it("creates a setup intent", async (context) => {
    const response = await context.agent.post(
      "/api/stripe/setup-intent" satisfies Match<RouteId>,
    );
    expect(response.status).toBe(200);
    expect(response.body.clientSecret).toBeDefined();
  });
});
