import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { modifyHooksServerNegotiate } from "./modifies/hooks.server";
import { modifyHooksNegotiate } from "./modifies/hooks";
import { modifyRootLayoutNegotiate } from "./modifies/root-layout.svelte";

export async function generate(options: Options) {
  const logger = getLogger(options);
  const modifies: File[] = [];

  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info("Modifying hooks.server.ts");
  const hooksServerPath = path.join(options.root, "src", "hooks.server.ts");
  pushResult(
    modifyOutcomeToFile(
      hooksServerPath,
      modifyHooksServerNegotiate(hooksServerPath),
    ),
  );

  logger.info("Modifying hooks.ts");
  const hooksPath = path.join(options.root, "src", "hooks.ts");
  pushResult(modifyOutcomeToFile(hooksPath, modifyHooksNegotiate(hooksPath)));

  logger.info("Modifying src/routes/+layout.svelte");
  const rootLayoutPath = path.join(
    options.root,
    "src",
    "routes",
    "+layout.svelte",
  );
  pushResult(
    modifyOutcomeToFile(
      rootLayoutPath,
      modifyRootLayoutNegotiate(rootLayoutPath),
    ),
  );

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
