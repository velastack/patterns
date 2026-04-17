import { json } from "@sveltejs/kit";
import stripe from "$lib/stripe";
import type { Stripe } from "stripe";

const createPaymentIntent = async (price: Stripe.Price) => {
  if (price.unit_amount === null || price.unit_amount === undefined) {
    console.error("Price does not have a per unit amount");
    throw new Error("Price does not have a per unit amount");
  }

  const intent = await stripe.paymentIntents.create({
    amount: price.unit_amount,
    currency: price.currency,
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: "never",
    },
  });

  if (!intent.client_secret) {
    console.error("Payment intent created without client secret");
    throw new Error("Failed to create payment intent");
  }

  return {
    type: "payment",
    clientSecret: intent.client_secret,
    amount: price.unit_amount,
    currency: price.currency,
  };
};

export const POST = async ({ request, locals }) => {
  let body;
  try {
    body = await request.json();
  } catch (error) {
    console.error("Invalid JSON in request body");
    return json({ error: "Invalid request body" }, { status: 400 });
  }

  const { priceId } = body as { priceId?: string };

  // Validate required fields
  if (!priceId || typeof priceId !== "string" || priceId === "") {
    console.error("Missing or invalid priceId");
    return json({ error: "Price ID is required" }, { status: 400 });
  }

  // Retrieve price from Stripe
  let price;
  try {
    price = await stripe.prices.retrieve(priceId);
  } catch (error) {
    console.error("Failed to retrieve price from Stripe:", priceId);
    return json(
      { error: "Invalid price ID or price not found" },
      { status: 404 },
    );
  }

  // Validate price is active
  if (!price.active) {
    console.error("Price is not active:", priceId);
    return json(
      { error: "This price is no longer available" },
      { status: 400 },
    );
  }

  try {
    const res = await createPaymentIntent(price);
    return json(res, { status: 200 });
  } catch (error) {
    console.error("Error creating payment intent for price:", priceId);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to create payment intent";
    return json({ error: errorMessage }, { status: 500 });
  }
};
