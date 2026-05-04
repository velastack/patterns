import { env } from "$env/dynamic/private";
import Stripe from "stripe";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
});

export default stripe;
