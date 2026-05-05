import type { File, Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { getLogger } from "../../../core/logger";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";

const SLUG = "disable-payments" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/disable/payments";
const DOCS = "/disable/payments";

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

  const patchCreates = await unlinkStripePaymentMethodsCustomer(options);
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
    "Drops Stripe collections, strips Stripe env credentials, reverts nav/signup edits, and deletes generated payment files. Does NOT delete Stripe products/prices in the Stripe dashboard, or uninstall stripe/@stripe/stripe-js packages.",
  requires: {
    auth: false,
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
