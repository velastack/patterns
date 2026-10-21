import fs from "node:fs";
import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { modifyRootLayoutSvelte } from "./modifies/root-layout.svelte";

/** Created by enable-payments for Stripe when auth was already on. */
export function hasStripeCustomer(root: string): boolean {
  return fs.existsSync(
    path.join(root, "src", "lib", "server", "stripe-customer.ts"),
  );
}

export async function generate(options: Options) {
  const logger = getLogger(options);
  const modifies: File[] = [];

  logger.info("Adding the cart to the navbar");
  const layoutPath = path.join(
    options.root,
    "src",
    "routes",
    "(public)",
    "root-layout.svelte",
  );
  const file = modifyOutcomeToFile(
    layoutPath,
    modifyRootLayoutSvelte(layoutPath),
  );
  if (file) modifies.push(file);

  return {
    creates: [],
    modifies,
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
