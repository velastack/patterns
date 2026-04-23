import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";
import { generate as generatePreview } from "./generate.preview";

const SLUG = "enable-subscriptions" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/enable/subscriptions";
const DOCS = "/enable/subscriptions";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env === "preview") {
    const previewRes = await generatePreview(options);
    return formatResult(mergeResults([baseRes, previewRes]));
  }

  const { createCollections } = await import("../../../runtime/collections");
  const migrationCreates = await createCollections(
    baseRes.collections,
    options,
  );

  const { generate: generateRuntime } = await import("./generate.runtime");
  const runtimeRes = await generateRuntime(options);
  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(
    await formatResult(
      mergeResults([
        { ...baseRes, creates: [...baseRes.creates, ...migrationCreates] },
        runtimeRes,
      ]),
    ),
    options,
  );
}

export default {
  version: VERSION,
  slug: SLUG,
  source: SOURCE,
  docs: DOCS,
  plan: "pro",
  title: "Enable subscriptions",
  summary:
    "Adds Stripe subscription billing with plan selection, cancel/resume, and webhook-synced subscription state. Requires enable-payments.",
  requires: {
    auth: true,
    api: false,
    apiKeys: false,
    i18n: false,
    teams: false,
    payments: true,
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
    raw: "vela enable subscriptions",
    base: "vela enable subscriptions",
    argv: [],
  },

  examples: [],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
