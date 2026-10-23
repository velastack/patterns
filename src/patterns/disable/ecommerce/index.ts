import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";

const SLUG = "disable-ecommerce" as const;
const VERSION = "1.2.0";
const SOURCE = "src/patterns/disable/ecommerce";
const DOCS = "/disable/ecommerce";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env !== "runtime") {
    return formatResult(baseRes, options);
  }

  const { generate: generateRuntime } = await import("./generate.runtime");
  const runtimeRes = await generateRuntime(options);
  const merged = await formatResult(
    mergeResults([baseRes, runtimeRes]),
    options,
  );

  if (options.input.destructive !== true) {
    return merged;
  }

  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(merged, options);
}

export default {
  version: VERSION,
  slug: SLUG,
  source: SOURCE,
  docs: DOCS,
  plan: "pro",
  title: "Disable ecommerce",
  summary:
    "Removes the cart, the checkout pages and the navbar cart button enable-ecommerce added. Payments, and the shadcn components the cart used, stay.",
  // Its own feature only: requiring payments would strand the cart if payments
  // went first (disable-payments is blocked while the cart exists, but a
  // project may have lost payments another way).
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
    ecommerce: true,
  },
  category: "payments" as const,
  tags: ["sveltekit", "ecommerce", "cart", "stripe", "shopify", "velastack"],

  command: {
    raw: "vela disable ecommerce",
    base: "vela disable ecommerce",
    argv: [],
  },

  examples: [],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
