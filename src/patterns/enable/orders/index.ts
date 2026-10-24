import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";
import { generate as generatePreview } from "./generate.preview";

const SLUG = "enable-orders" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/enable/orders";
const DOCS = "/enable/orders";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);
  if (options.env === "preview") {
    const previewRes = await generatePreview(options);
    return formatResult(mergeResults([baseRes, previewRes]), options);
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
      options,
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
  title: "Enable orders",
  summary:
    "Records what was bought through Stripe Checkout: orders and their lines, written by the webhook so a redelivery updates rather than duplicates. The success page shows the order; with auth, users see their own orders, and a paid order notifies them when notifications are on.",
  requires: {
    auth: false,
    api: false,
    apiKeys: false,
    backend: true,
    i18n: false,
    teams: false,
    payments: true,
    blog: false,
    contentNegotiation: false,
    cms: false,
    workflows: true,
    ecommerce: true,
    // The pages are shadcn-svelte markup; there is no plain variant.
    ui: "shadcn",
    // Shopify keeps its own orders; WhatsApp orders are hosted-form submissions.
    providers: { payments: ["stripe"] },
  },
  category: "payments" as const,
  tags: [
    "sveltekit",
    "ecommerce",
    "orders",
    "stripe",
    "webhooks",
    "pocketbase",
    "velastack",
  ],
  command: {
    raw: "vela enable orders",
    base: "vela enable orders",
    argv: [],
  },
  examples: [],
  tests: 0,
  baseline: "velastack",
  generate,
} satisfies Pattern;
