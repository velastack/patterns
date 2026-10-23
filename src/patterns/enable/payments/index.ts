import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase, PROVIDERS } from "./generate";
import { generate as generatePreview } from "./generate.preview";

const SLUG = "enable-payments" as const;
const VERSION = "2.4.0";
const SOURCE = "src/patterns/enable/payments";
const DOCS = "/enable/payments";

export async function generate(options: Options) {
  if (options.env === "preview") {
    const baseRes = await generateBase(options);
    const previewRes = await generatePreview(options);
    return formatResult(mergeResults([baseRes, previewRes]), options);
  }

  const { generate: generateRuntime, hasVitest } =
    await import("./generate.runtime");
  const baseRes = await generateBase(options, {
    unitTests: hasVitest(options.root),
  });
  const runtimeRes = await generateRuntime(options);
  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(
    await formatResult(mergeResults([baseRes, runtimeRes]), options),
    options,
  );
}

export default {
  version: VERSION,
  slug: SLUG,
  source: SOURCE,
  docs: DOCS,
  plan: "pro",
  title: "Enable payments",
  summary:
    "Adds payments with Stripe (product/price sync, a checkout dialog, and saved payment methods when auth is enabled), Shopify (a Storefront client and a Buy button that hands off to Shopify's checkout), or WhatsApp (an Order button that opens a prefilled chat with the business and records the order to a hosted VelaStack form).",
  // Stripe adds backend and workflows; see its provider entry.
  requires: {
    auth: false,
    api: false,
    apiKeys: false,
    backend: false,
    i18n: false,
    teams: false,
    payments: false,
    blog: false,
    contentNegotiation: false,
    cms: false,
    // The pages are shadcn-svelte markup; there is no plain variant.
    ui: "shadcn",
  },
  category: "payments" as const,
  tags: [
    "sveltekit",
    "payments",
    "stripe",
    "shopify",
    "whatsapp",
    "pocketbase",
    "velastack",
    "checkout",
  ],

  command: {
    raw: "vela enable payments --provider stripe",
    base: "vela enable payments",
    argv: [],
  },

  examples: [
    {
      command: "--provider stripe",
      description:
        "Stripe keys in .env, products and prices synced into PocketBase, and a /payment page with a checkout dialog.",
    },
    {
      command: "--provider shopify",
      description:
        "A Storefront API client and a Buy button that sends the buyer to Shopify's checkout. No backend needed.",
    },
    {
      command: "--provider whatsapp",
      description:
        "An Order on WhatsApp button: the customer's name, phone and order open a chat with the business, and the order is recorded to a hosted VelaStack form. No backend needed.",
    },
  ],

  tests: 0,

  baseline: "velastack",

  providers: PROVIDERS,

  generate,
} satisfies Pattern;
