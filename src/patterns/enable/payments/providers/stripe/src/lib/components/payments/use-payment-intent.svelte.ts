import { toast } from "svelte-sonner";

export interface PaymentIntentResult {
  type: "payment" | "confirm";
  amount?: number;
  currency?: string;
  clientSecret?: string;
  brand?: string;
  last4?: string;
  /**
   * What the intent was created with: `off_session` when the card is kept
   * for the signed-in customer. The card form has to match it.
   */
  setupFutureUsage?: "off_session" | null;
}

export function usePaymentIntent() {
  let isLoading = $state(false);

  async function fetchPaymentIntent({
    priceId,
  }: {
    priceId: string;
  }): Promise<PaymentIntentResult | null> {
    isLoading = true;

    const res = await fetch("/api/stripe/payment-intent", {
      method: "POST",
      body: JSON.stringify({
        priceId: priceId,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      toast.error("Failed to initialize payment");
      return null;
    }

    return res.json();
  }

  async function fetchSetupIntent(): Promise<PaymentIntentResult | null> {
    isLoading = true;

    const res = await fetch("/api/stripe/setup-intent", {
      method: "POST",
    });

    if (!res.ok) {
      toast.error("Failed to initialize setup");
      return null;
    }

    return res.json();
  }

  return {
    get isLoading() {
      return isLoading;
    },
    fetchPaymentIntent,
    fetchSetupIntent,
  };
}
