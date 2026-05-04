import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { toast } from "svelte-sonner";
import { env } from "$env/dynamic/public";

export function useStripe() {
  let stripe = $state<Stripe | null>(null);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  async function initialize() {
    try {
      stripe = await loadStripe(env.PUBLIC_STRIPE_PUBLISHABLE_KEY);
      isLoading = false;
    } catch (err) {
      console.error("Failed to load Stripe:", err);
      error = "Failed to initialize payment system";
      toast.error("Failed to initialize payment system");
      isLoading = false;
    }
  }

  // Auto-initialize
  initialize();

  return {
    get stripe() {
      return stripe;
    },
    get isLoading() {
      return isLoading;
    },
    get error() {
      return error;
    },
  };
}
