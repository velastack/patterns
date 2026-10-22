import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { unmodifyRootLayoutSvelte } from "./modifies/root-layout.svelte";

export async function generate(options: Options) {
  const logger = getLogger(options);
  const modifies: File[] = [];

  logger.info("Taking the cart out of the navbar");
  const layoutPath = path.join(
    options.root,
    "src",
    "routes",
    "(public)",
    "root-layout.svelte",
  );
  const file = modifyOutcomeToFile(
    layoutPath,
    unmodifyRootLayoutSvelte(layoutPath),
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
