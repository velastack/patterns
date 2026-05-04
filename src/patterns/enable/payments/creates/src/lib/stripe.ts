import { STRIPE_SECRET_KEY } from "$env/static/private";
import Stripe from "stripe";

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
});

export default stripe;
