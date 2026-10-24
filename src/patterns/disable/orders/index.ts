import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";

const SLUG = "disable-orders" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/disable/orders";
const DOCS = "/disable/orders";

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
  title: "Disable orders",
  summary:
    "Removes the order handlers, the orders pages and the orders and order_lines collections enable-orders added, and puts the success page back to Stripe's summary. Payments and the cart stay.",
  // Nothing required: a project may have lost payments or the cart another
  // way, and the order files should still come out.
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
  tags: ["sveltekit", "ecommerce", "orders", "stripe", "velastack"],
  command: {
    raw: "vela disable orders",
    base: "vela disable orders",
    argv: [],
  },
  examples: [],
  tests: 0,
  baseline: "velastack",
  generate,
} satisfies Pattern;
