import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { modifyLayoutSvelte } from "./modifies/layout.svelte";

export async function generate(options: Options) {
  const logger = getLogger(options);
  const modifies: File[] = [];

  logger.info("Modifying src/routes/+layout.svelte");
  const layoutPath = path.join(options.root, "src", "routes", "+layout.svelte");
  const file = modifyOutcomeToFile(layoutPath, modifyLayoutSvelte(layoutPath));
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
