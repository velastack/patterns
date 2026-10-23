import type {
  Component,
  Options,
  Package,
  Provider,
  Result,
} from "../../../core/types";
import type { EnvEdit } from "../../../runtime/env";
import {
  providerCreates,
  providerEnvEdits,
  resolveProvider,
} from "../../../core/providers";
import { InvalidArgumentError } from "../../../core/errors";
import { VELASTACK_WHATSAPP } from "../../../core/constants";
import { filesFromGlob } from "../../../core/util";

/**
 * The providers in prompt order. Each one's `env` keys are what the CLI asks
 * for, what `generate.runtime.ts` writes to `.env` (in this order, under a
 * `# <Label> credentials` heading) and declares in `src/env.ts`.
 */
export const PROVIDERS: Provider[] = [
  {
    id: "stripe",
    label: "Stripe",
    env: [
      {
        key: "STRIPE_SECRET_KEY",
        label: "Stripe secret key",
        placeholder: "sk_...",
        secret: true,
        required: true,
        description:
          "Stripe secret key (`sk_...`) the server calls the Stripe API with.",
      },
      {
        key: "PUBLIC_STRIPE_PUBLISHABLE_KEY",
        label: "Stripe publishable key",
        placeholder: "pk_...",
        public: true,
        required: true,
        description:
          "Stripe publishable key (`pk_...`) that Stripe.js loads in the browser.",
      },
      {
        key: "STRIPE_WEBHOOK_SECRET",
        label: "Stripe webhook signing secret",
        placeholder: "whsec_...",
        secret: true,
        required: true,
        description:
          "Signing secret (`whsec_...`) that `/webhooks/stripe` verifies events with.",
      },
    ],
    // The webhook route predates the `src/env.ts` declarations, so a project
    // that enabled payments before them is still recognised.
    markers: [
      { env: "STRIPE_SECRET_KEY" },
      { path: "src/routes/webhooks/stripe" },
    ],
    // Products, prices and customers are synced into PocketBase by workflows.
    requires: { backend: true, workflows: true },
  },
  {
    id: "shopify",
    label: "Shopify",
    env: [
      {
        key: "PUBLIC_SHOPIFY_STORE_DOMAIN",
        label: "Shopify store domain",
        placeholder: "your-store.myshopify.com",
        public: true,
        required: true,
        description:
          "The store's `*.myshopify.com` domain the Storefront API is called on.",
      },
      {
        key: "PUBLIC_SHOPIFY_STOREFRONT_TOKEN",
        label: "Shopify Storefront API public access token",
        public: true,
        required: true,
        description:
          "Public Storefront API access token, from the store's Headless channel.",
      },
    ],
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    env: [
      {
        key: "PUBLIC_WHATSAPP_NUMBER",
        label: "WhatsApp number orders are sent to",
        placeholder: "+353 1 555 0100",
        public: true,
        required: true,
        description:
          "The business's WhatsApp number, with country code, that orders open a chat with.",
      },
      {
        key: "PUBLIC_WHATSAPP_ORDER_FORM",
        label: "Hosted VelaStack form orders are recorded to",
        placeholder: "https://velastack.dev/v1/projects/<project>/forms/order",
        public: true,
        description:
          "The hosted VelaStack form each order is recorded to, so it is kept even if the chat is never sent. Empty records nothing.",
      },
    ],
  },
];

/** What `resolveProvider` needs; `index.ts` spreads the rest of the metadata. */
export const META = { slug: "enable-payments", providers: PROVIDERS };

/** The `.env` lines for a provider, under a `# <Label> credentials` heading. */
export function envEditsFor(
  provider: Provider,
  supplied: Record<string, string> = {},
): EnvEdit[] {
  return providerEnvEdits(provider, `${provider.label} credentials`, supplied);
}

// `select` is the currency select every provider gets.
const COMPONENTS: Record<string, Component[]> = {
  stripe: ["dialog", "input", "label", "select"],
  shopify: ["button", "select"],
  whatsapp: ["button", "dialog", "input", "label", "textarea", "select"],
};

const PACKAGES: Record<string, Package[]> = {
  stripe: ["stripe", "@stripe/stripe-js"],
  shopify: ["@shopify/storefront-api-client"],
  whatsapp: [VELASTACK_WHATSAPP],
};

// Shared by every provider: the currency prices show in, and its select.
const createsRaw = import.meta.glob<string>("./creates/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const providersRaw = import.meta.glob<string>("./providers/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const providersAppModeRaw = import.meta.glob<string>(
  "./providers-app-mode/**",
  { query: "?raw", import: "default", eager: true },
);

export interface GenerateContext {
  /**
   * The project can run unit tests (vitest is installed), so a provider's
   * `*.test.ts` beside its code is written too. Server tests (`server.test.ts`)
   * always are: they run under `vela test:server`, which brings its own runner.
   */
  unitTests?: boolean;
}

const isUnitTest = (path: string) =>
  path.endsWith(".test.ts") && !path.endsWith("server.test.ts");

export async function generate(
  options: Options,
  { unitTests = false }: GenerateContext = {},
) {
  const provider = resolveProvider(META, options);

  // A second provider would leave the project with both, and the patterns
  // built on payments could no longer tell which one it uses.
  const current = options.providers?.payments;
  if (current !== undefined && current !== provider.id) {
    const label =
      PROVIDERS.find((candidate) => candidate.id === current)?.label ?? current;
    throw new InvalidArgumentError(
      `This project already uses ${label} payments. To switch to ${provider.label}, ` +
        "run `vela disable payments` first, then enable payments again.",
    );
  }
  // Stripe keeps cards and customers for signed-in users; Shopify's checkout
  // owns its customers and WhatsApp has none, so neither has app-mode files.
  const isAppMode = options.features.auth;

  const creates = new Map(
    [
      ...Object.values(filesFromGlob(createsRaw, "./creates/")),
      ...providerCreates(providersRaw, provider.id),
    ]
      .filter((file) => unitTests || !isUnitTest(file.path))
      .map((file) => [file.path, file]),
  );
  if (isAppMode) {
    for (const file of providerCreates(
      providersAppModeRaw,
      provider.id,
      "./providers-app-mode/",
    )) {
      creates.set(file.path, file);
    }
  }

  const components = [...(COMPONENTS[provider.id] ?? [])];
  if (isAppMode && provider.id === "stripe") components.push("alert-dialog");

  return {
    creates: [...creates.values()].sort((a, b) => a.path.localeCompare(b.path)),
    modifies: [],
    deletes: [],
    components,
    packages: PACKAGES[provider.id] ?? [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
