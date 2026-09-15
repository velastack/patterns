import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { planDropsForCollections } from "../../destroy/shared";
import { unmodifyAppLayout } from "./modifies/modify-app-layout";
import { unmodifyLayoutServer } from "./modifies/+layout.server";

export async function generate(options: Options) {
  const logger = getLogger(options);
  const modifies: File[] = [];
  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info("Reverting (app) +layout.svelte");
  const appLayoutPath = path.join(
    options.root,
    "src",
    "routes",
    "(app)",
    "+layout.svelte",
  );
  pushResult(
    modifyOutcomeToFile(appLayoutPath, unmodifyAppLayout(appLayoutPath)),
  );

  logger.info("Reverting (app) +layout.server.ts");
  const appLayoutServerPath = path.join(
    options.root,
    "src",
    "routes",
    "(app)",
    "+layout.server.ts",
  );
  pushResult(
    modifyOutcomeToFile(
      appLayoutServerPath,
      unmodifyLayoutServer(appLayoutServerPath),
    ),
  );

  // The timeAgo helper enable-notifications added to $lib/utils stays: it is
  // generic, and other code may have started using it.

  const collectionDrops = await planDropsForCollections(
    ["notifications"],
    options,
  );

  return {
    creates: [],
    modifies,
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops,
  } satisfies Result;
}
