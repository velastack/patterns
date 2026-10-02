import type { EnvVarSpec } from "../../../../runtime/env-vars-file";

/**
 * What `src/env.ts` has to declare for SvelteKit 3 to expose the Stripe keys
 * through `$app/env/private` and `$app/env/public`: an undeclared variable is
 * not exposed at all. `preview-modifies/src/env.ts` shows the same entries.
 */
export const STRIPE_ENV_VARS: EnvVarSpec[] = [
  {
    name: "STRIPE_SECRET_KEY",
    description:
      "Stripe secret key (`sk_...`) the server calls the Stripe API with.",
  },
  {
    name: "STRIPE_WEBHOOK_SECRET",
    description:
      "Signing secret (`whsec_...`) that `/webhooks/stripe` verifies events with.",
  },
  {
    name: "PUBLIC_STRIPE_PUBLISHABLE_KEY",
    public: true,
    description:
      "Stripe publishable key (`pk_...`) that Stripe.js loads in the browser.",
  },
];

export const STRIPE_ENV_VAR_NAMES = STRIPE_ENV_VARS.map((spec) => spec.name);
