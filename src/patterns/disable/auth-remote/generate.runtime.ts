import path from "node:path";
import fs from "node:fs";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { unmodifyLayoutServer } from "../auth/modifies/+layout.server";
import { unmodifyRootLayoutSvelte } from "../auth/modifies/root-layout.svelte";
import { unmodifyHooksServer } from "../auth/modifies/hooks.server";
import { planDropsForCollections } from "../../destroy/shared";

export async function generate(options: Options) {
  const logger = getLogger(options);
  const modifies: File[] = [];
  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info("Reverting +layout.server.ts");
  const layoutServerFile = path.join(
    options.root,
    "src",
    "routes",
    "+layout.server.ts",
  );
  pushResult(
    modifyOutcomeToFile(
      layoutServerFile,
      unmodifyLayoutServer(layoutServerFile),
    ),
  );

  logger.info("Reverting root layout");
  const layoutCandidates = [
    path.join(options.root, "src", "routes", "(public)", "root-layout.svelte"),
    path.join(options.root, "src", "routes", "root-layout.svelte"),
    path.join(options.root, "src", "routes", "(public)", "+layout.svelte"),
    path.join(options.root, "src", "routes", "+layout.svelte"),
  ];
  const layoutFile =
    layoutCandidates.find((p) => fs.existsSync(p)) ?? layoutCandidates[0];
  pushResult(
    modifyOutcomeToFile(layoutFile, unmodifyRootLayoutSvelte(layoutFile)),
  );

  logger.info("Reverting hooks.server.ts");
  const hooksServerFile = path.join(options.root, "src", "hooks.server.ts");
  pushResult(
    modifyOutcomeToFile(hooksServerFile, unmodifyHooksServer(hooksServerFile)),
  );

  const collectionDrops = await planDropsForCollections(
    ["oauth_accounts"],
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
