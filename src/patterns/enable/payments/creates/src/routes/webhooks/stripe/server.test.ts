import { describe, it, expect } from "vitest";
import type { RouteId } from "./$types";
import type { Match } from "@velastack/pocketbase";
import type Stripe from "stripe";
import stripe from "$lib/stripe";

describe("POST /webhooks/stripe", () => {
  it("accepts valid webhook signature", async (context) => {
    const event = {
      id: `evt_test_${Date.now()}`,
      object: "event",
      api_version: "2024-11-20.acacia",
      created: Math.floor(Date.now() / 1000),
      type: "test.event",
      data: {
        object: {},
      },
      livemode: false,
      pending_webhooks: 0,
      request: {
        id: null,
        idempotency_key: null,
      },
    } as unknown as Stripe.Event;

    const payload = JSON.stringify(event);
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    });

    const response = await context.request
      .post("/webhooks/stripe" satisfies Match<RouteId>)
      .set("stripe-signature", signature)
      .send(payload)
      .set("Content-Type", "application/json");

    expect(response.status).toBe(200);
    expect(response.body.received).toBe(true);
    expect(response.body.eventId).toBe(event.id);
    expect(response.body.eventType).toBe("test.event");
  });

  it("rejects invalid webhook signature", async (context) => {
    const event = {
      id: `evt_test_${Date.now()}`,
      object: "event",
      api_version: "2024-11-20.acacia",
      created: Math.floor(Date.now() / 1000),
      type: "test.event",
      data: {
        object: {},
      },
      livemode: false,
      pending_webhooks: 0,
      request: {
        id: null,
        idempotency_key: null,
      },
    } as unknown as Stripe.Event;

    const payload = JSON.stringify(event);

    const response = await context.request
      .post("/webhooks/stripe" satisfies Match<RouteId>)
      .set("stripe-signature", "invalid_signature")
      .send(payload)
      .set("Content-Type", "application/json");

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Webhook processing failed");
  });

  it("rejects request without signature header", async (context) => {
    const event = {
      id: `evt_test_${Date.now()}`,
      object: "event",
      api_version: "2024-11-20.acacia",
      created: Math.floor(Date.now() / 1000),
      type: "test.event",
      data: {
        object: {},
      },
      livemode: false,
      pending_webhooks: 0,
      request: {
        id: null,
        idempotency_key: null,
      },
    } as unknown as Stripe.Event;

    const payload = JSON.stringify(event);

    const response = await context.request
      .post("/webhooks/stripe" satisfies Match<RouteId>)
      .send(payload)
      .set("Content-Type", "application/json");

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Webhook processing failed");
    expect(response.body.message).toBe("Missing stripe-signature header");
  });

  it("handles duplicate webhook events", async (context) => {
    const event = {
      id: `evt_test_${Date.now()}`,
      object: "event",
      api_version: "2024-11-20.acacia",
      created: Math.floor(Date.now() / 1000),
      type: "test.event",
      data: {
        object: {},
      },
      livemode: false,
      pending_webhooks: 0,
      request: {
        id: null,
        idempotency_key: null,
      },
    } as unknown as Stripe.Event;

    const payload = JSON.stringify(event);
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    });

    // Send first webhook
    const response1 = await context.request
      .post("/webhooks/stripe" satisfies Match<RouteId>)
      .set("stripe-signature", signature)
      .send(payload)
      .set("Content-Type", "application/json");

    expect(response1.status).toBe(200);
    expect(response1.body.received).toBe(true);

    // Send duplicate webhook
    const response2 = await context.request
      .post("/webhooks/stripe" satisfies Match<RouteId>)
      .set("stripe-signature", signature)
      .send(payload)
      .set("Content-Type", "application/json");

    expect(response2.status).toBe(200);
    expect(response2.body.received).toBe(true);
    expect(response2.body.message).toBe("Event already processed");
  });
});
