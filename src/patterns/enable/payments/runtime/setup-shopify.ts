import type { Options, Result } from "../../../../core/types";
import { getLogger } from "../../../../core/logger";
import { buyPageSnippet } from "../shopify-page";

/**
 * Shopify keeps products, customers and checkout on its side, so past the env
 * there is only the demo page, and only when a variant to sell was given.
 */
export async function setupShopify(options: Options) {
  const logger = getLogger(options);
  const variantId =
    typeof options.input.demoId === "string" ? options.input.demoId.trim() : "";

  const creates = [];
  if (variantId) {
    logger.info("Creating payment +page.svelte");
    creates.push({
      path: "src/routes/(public)/payment/+page.svelte",
      language: "svelte",
      content: buyPageSnippet(variantId),
      status: "success" as const,
    });
  }

  return {
    creates,
    modifies: [],
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
