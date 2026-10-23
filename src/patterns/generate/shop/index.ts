import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { generate as generateBase, META, PROVIDERS } from "./generate";

const SLUG = "generate-shop" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/generate/shop";
const DOCS = "/generate/shop";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env !== "runtime") {
    return formatResult(baseRes, options);
  }

  const { assertNoneExist } = await import("./generate.runtime");
  assertNoneExist(options.root, baseRes.creates);
  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(await formatResult(baseRes, options), options);
}

export default {
  version: VERSION,
  slug: SLUG,
  source: SOURCE,
  docs: DOCS,
  plan: "pro",
  title: "Generate a shop",
  summary:
    "Generates a product listing and product pages for the project's cart, in its payments provider's own terms: Stripe's synced catalog read on the server, Shopify's Storefront API, or a catalog module (or the CMS) for WhatsApp. The pages are yours to edit; the generator never writes over them.",
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
    ecommerce: true,
    // The pages are shadcn-svelte markup, like the cart they add to.
    ui: "shadcn",
  },
  category: "payments" as const,
  tags: [
    "sveltekit",
    "ecommerce",
    "shop",
    "catalog",
    "stripe",
    "shopify",
    "whatsapp",
    "velastack",
  ],

  command: {
    raw: "vela generate shop",
    base: "vela generate shop",
    argv: [],
  },

  examples: [],

  tests: 0,

  baseline: "velastack",

  providers: PROVIDERS,
  inheritsProvider: META.inheritsProvider,

  generate,
} satisfies Pattern;
