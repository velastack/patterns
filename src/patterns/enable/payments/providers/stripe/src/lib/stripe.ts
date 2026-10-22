import { STRIPE_SECRET_KEY } from "$app/env/private";
import Stripe from "stripe";

let client: Stripe | undefined;

function getClient(): Stripe {
  if (!client) {
    if (!STRIPE_SECRET_KEY) {
      throw new Error(
        "STRIPE_SECRET_KEY is not set, so Stripe cannot be called.",
      );
    }
    // No apiVersion: the SDK pins the version it was built for, and naming one
    // here fell behind it in every fresh project.
    client = new Stripe(STRIPE_SECRET_KEY);
  }
  return client;
}

// Built on first use, not on import. The workflow worker imports every workflow
// at startup, and some import this module, so a client built at module scope
// takes the whole server down wherever the key is unset - a pull request
// preview, say - instead of failing only the requests that need Stripe.
const stripe = new Proxy({} as Stripe, {
  get(_target, property) {
    const value = Reflect.get(getClient(), property);
    return typeof value === "function" ? value.bind(getClient()) : value;
  },
});

export default stripe;
