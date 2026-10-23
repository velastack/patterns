import type { Options, Pattern, Result } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { allProviderPaths } from "../../../core/providers";
import { toDeleteEntry } from "../shared";

const SLUG = "destroy-shop" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/destroy/shop";
const DOCS = "/destroy/shop";

const shopRaw = import.meta.glob<string>(
  ["../../generate/shop/providers/**", "../../generate/shop/providers-cms/**"],
  { query: "?raw", import: "default", eager: true },
);

/** Every path `generate-shop` can write, whichever provider wrote it. */
export const SHOP_PATHS = allProviderPaths(shopRaw);

export async function generate(options: Options) {
  // The shop follows the payments provider; with none detected (payments
  // already gone) every provider's files are removed, missing ones skipped.
  const detected = options.providers?.payments;
  const paths = detected ? allProviderPaths(shopRaw, detected) : SHOP_PATHS;

  const result: Result = {
    creates: [],
    modifies: [],
    deletes: paths.map(toDeleteEntry),
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  };
  const formatted = await formatResult(result, options);

  if (options.env !== "runtime" || options.input.destructive !== true) {
    return formatted;
  }

  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(formatted, options);
}

export default {
  version: VERSION,
  slug: SLUG,
  source: SOURCE,
  docs: DOCS,
  plan: "pro",
  title: "Destroy a shop",
  summary:
    "Removes the shop pages generate-shop wrote (and the catalog module on WhatsApp). The cart, payments and anything in Stripe, Shopify or the CMS stay.",
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
  },
  category: "payments" as const,
  tags: ["sveltekit", "ecommerce", "shop", "velastack"],

  command: {
    raw: "vela destroy shop",
    base: "vela destroy shop",
    argv: [],
  },

  examples: [],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
