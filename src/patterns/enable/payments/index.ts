import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";
import { generate as generatePreview } from "./generate.preview";

const SLUG = "enable-payments" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/enable/payments";
const DOCS = "/enable/payments";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env === "preview") {
    const previewRes = await generatePreview(options);
    return formatResult(mergeResults([baseRes, previewRes]));
  }

  const { generate: generateRuntime } = await import("./generate.runtime");
  const runtimeRes = await generateRuntime(options);
  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(
    await formatResult(mergeResults([baseRes, runtimeRes])),
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
    "Adds Stripe payments with product/price sync, checkout flow, and optional saved payment methods when auth is enabled.",
  requires: {
    auth: false,
    api: false,
    apiKeys: false,
    i18n: false,
    teams: false,
    payments: false,
  },
  category: "payments" as const,
  tags: [
    "sveltekit",
    "payments",
    "stripe",
    "pocketbase",
    "velastack",
    "checkout",
  ],

  command: {
    raw: "vela enable payments",
    base: "vela enable payments",
    argv: [],
  },

  examples: [],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
