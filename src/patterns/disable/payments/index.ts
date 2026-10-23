import type { File, Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { getLogger } from "../../../core/logger";
import { mergeResults } from "../../../core/util";
import { generate as generateBase, providersToRemove } from "./generate";

const SLUG = "disable-payments" as const;
const VERSION = "2.4.0";
const SOURCE = "src/patterns/disable/payments";
const DOCS = "/disable/payments";

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

  // Stripe's collections live in PocketBase; a Shopify project may have none.
  const isStripe = providersToRemove(options).some(
    (provider) => provider.id === "stripe",
  );
  const patchCreates =
    isStripe && options.features.backend
      ? await unlinkStripePaymentMethodsCustomer(options)
      : [];
  const finalResult = {
    ...merged,
    creates: [...merged.creates, ...patchCreates],
  };

  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(finalResult, options);
}

async function unlinkStripePaymentMethodsCustomer(
  options: Options,
): Promise<File[]> {
  const { withPocketbase } = await import("../../../runtime/pocketbase");
  const { applyCollectionFieldsPatches } =
    await import("../../../runtime/collections");
  const logger = getLogger(options);

  let creates: File[] = [];
  await withPocketbase(options.root, async (pb) => {
    let collection;
    try {
      collection = await pb.collections.getOne("stripe_payment_methods");
    } catch (error) {
      if ((error as { status?: number }).status === 404) return;
      throw error;
    }

    if (
      !collection.fields.some((f: { name: string }) => f.name === "customer")
    ) {
      return;
    }

    creates = await applyCollectionFieldsPatches(
      pb,
      [
        {
          collectionName: "stripe_payment_methods",
          changes: [{ op: "remove", fieldName: "customer" }],
        },
      ],
      options,
      logger,
    );
  });
  return creates;
}

export default {
  version: VERSION,
  slug: SLUG,
  source: SOURCE,
  docs: DOCS,
  plan: "pro",
  title: "Disable payments",
  summary:
    "Removes the detected payment provider's files and env credentials. For Stripe it also drops the Stripe collections and reverts the nav/signup edits. Does NOT touch products in the Stripe dashboard or Shopify admin, orders recorded to a hosted VelaStack form, or uninstall the provider's packages.",
  // Stripe's collections need the backend, which enable-payments already
  // required for Stripe; Shopify and WhatsApp have none to drop.
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
  },
  // The cart imports the payments client, so it has to go first. (Subscriptions
  // would belong here too, but there is no feature flag for it yet.)
  blockedBy: ["ecommerce"],
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
    raw: "vela disable payments",
    base: "vela disable payments",
    argv: [],
  },

  examples: [],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
