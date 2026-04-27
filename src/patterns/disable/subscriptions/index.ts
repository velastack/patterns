import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";

const SLUG = "disable-subscriptions" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/disable/subscriptions";
const DOCS = "/disable/subscriptions";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env !== "runtime") {
    return formatResult(baseRes);
  }

  const { generate: generateRuntime } = await import("./generate.runtime");
  const runtimeRes = await generateRuntime(options);
  const merged = await formatResult(mergeResults([baseRes, runtimeRes]));

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
  title: "Disable subscriptions",
  summary:
    "Drops the stripe_subscriptions collection, reverts billing / layout / nav edits, and removes subscription webhook handlers and sync endpoint. Leaves the payments pattern intact.",
  requires: {
    auth: true,
    api: false,
    apiKeys: false,
    i18n: false,
    teams: false,
    payments: true,
    blog: false,
    contentNegotiation: false,
  },
  category: "payments" as const,
  tags: [
    "sveltekit",
    "payments",
    "stripe",
    "subscriptions",
    "pocketbase",
    "velastack",
    "billing",
  ],

  command: {
    raw: "vela disable subscriptions",
    base: "vela disable subscriptions",
    argv: [],
  },

  examples: [],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
