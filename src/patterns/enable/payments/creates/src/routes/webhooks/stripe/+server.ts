import Stripe from "stripe";
import { json } from "@sveltejs/kit";
import { STRIPE_WEBHOOK_SECRET } from "$env/static/private";
import stripe from "$lib/stripe";
import { handlePaymentIntentSucceeded } from "./handlers/payment-intent/succeeded";

const processedEvents = new Set<string>();

async function verifyWebhookSignature(
  request: Request,
  webhookSecret: string,
): Promise<Stripe.Event> {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    throw new Error("Missing stripe-signature header");
  }

  if (!webhookSecret) {
    throw new Error("Missing webhook secret");
  }

  try {
    return stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    throw new Error("Invalid signature");
  }
}

export const POST = async ({ request, locals }) => {
  try {
    const event = await verifyWebhookSignature(request, STRIPE_WEBHOOK_SECRET);

    if (processedEvents.has(event.id)) {
      console.log(`Event ${event.id} already processed, skipping`);
      return json({ received: true, message: "Event already processed" });
    }

    processedEvents.add(event.id);

    console.log(`Processing webhook event: ${event.type} (${event.id})`);

    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object, locals);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return json({
      received: true,
      eventId: event.id,
      eventType: event.type,
    });
  } catch (error) {
    console.error("Webhook processing error:", error);

    return json(
      {
        error: "Webhook processing failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
};
