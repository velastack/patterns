import path from "node:path";
import fs from "node:fs";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { findSvelteConfigPath } from "../../../runtime/modify-svelte-config-remote";
import { modifySvelteConfigMdsvex } from "./modifies/svelte.config";
import { modifyRootLayoutSvelte } from "./modifies/root-layout-svelte";
import { modifyPublicRootLayout } from "./modifies/public-root-layout-svelte";

export async function generate(options: Options) {
  const logger = getLogger(options);
  const modifies: File[] = [];

  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info("Modifying svelte.config");
  const svelteConfigPath = findSvelteConfigPath(options.root);
  pushResult(
    modifyOutcomeToFile(
      svelteConfigPath,
      modifySvelteConfigMdsvex(svelteConfigPath),
    ),
  );

  logger.info("Modifying src/routes/+layout.svelte");
  const rootLayoutPath = path.join(
    options.root,
    "src",
    "routes",
    "+layout.svelte",
  );
  pushResult(
    modifyOutcomeToFile(rootLayoutPath, modifyRootLayoutSvelte(rootLayoutPath)),
  );

  logger.info("Modifying public root layout");
  const publicLayoutCandidates = [
    path.join(options.root, "src", "routes", "(public)", "root-layout.svelte"),
    path.join(options.root, "src", "routes", "root-layout.svelte"),
    path.join(options.root, "src", "routes", "(public)", "+layout.svelte"),
  ];
  const publicLayoutPath =
    publicLayoutCandidates.find((p) => fs.existsSync(p)) ??
    publicLayoutCandidates[0];
  pushResult(
    modifyOutcomeToFile(
      publicLayoutPath,
      modifyPublicRootLayout(publicLayoutPath),
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
