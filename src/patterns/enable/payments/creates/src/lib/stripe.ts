import { STRIPE_SECRET_KEY } from "$app/env/private";
import Stripe from "stripe";

// No apiVersion: the SDK pins the version it was built for, and naming one
// here fell behind it in every fresh project.
const stripe = new Stripe(STRIPE_SECRET_KEY);

export default stripe;
