import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase, META, PROVIDERS } from "./generate";
import { generate as generatePreview } from "./generate.preview";

const SLUG = "enable-ecommerce" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/enable/ecommerce";
const DOCS = "/enable/ecommerce";

export async function generate(options: Options) {
  if (options.env === "preview") {
    const baseRes = await generateBase(options);
    const previewRes = await generatePreview(options);
    return formatResult(mergeResults([baseRes, previewRes]), options);
  }

  const { generate: generateRuntime, hasStripeCustomer } =
    await import("./generate.runtime");
  const baseRes = await generateBase(options, {
    stripeCustomer: hasStripeCustomer(options.root),
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
  title: "Enable ecommerce",
  summary:
    "Adds a cart to the navbar and a checkout, on the project's payments provider: a browser cart that checks out through Stripe Checkout, or a Shopify Storefront cart that hands off to Shopify's checkout.",
  requires: {
    auth: false,
    api: false,
    apiKeys: false,
    backend: false,
    i18n: false,
    teams: false,
    payments: true,
    blog: false,
    contentNegotiation: false,
    cms: false,
    // The cart is shadcn-svelte markup; there is no plain variant.
    ui: "shadcn",
  },
  category: "payments" as const,
  tags: [
    "sveltekit",
    "ecommerce",
    "cart",
    "checkout",
    "stripe",
    "shopify",
    "velastack",
  ],

  command: {
    raw: "vela enable ecommerce",
    base: "vela enable ecommerce",
    argv: [],
  },

  examples: [],

  tests: 0,

  baseline: "velastack",

  providers: PROVIDERS,
  inheritsProvider: META.inheritsProvider,

  generate,
} satisfies Pattern;
