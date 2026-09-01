import fs from "node:fs";
import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import {
  probeFirstExisting,
  VITE_CONFIG_CANDIDATES,
} from "../../../runtime/config-target";
import { modifyViteConfig } from "./modifies/vite-config";
import {
  DEFAULT_LOCALE,
  WUCHALE_LOCALE,
  modifyLayoutServer,
} from "./modifies/layout.server";
import { modifyLayoutSvelte } from "./modifies/layout.svelte";

/**
 * Drop any create that already exists on disk.
 *
 * `writeResult` overwrites an existing create whose content differs and
 * reports it as a modify, which for these files would mean a re-run silently
 * resetting a developer's edits to `$lib/cms.ts` or the backend config. The
 * wiring is theirs once it has been written; a re-run only fills in what is
 * missing.
 */
export function keepMissing(creates: File[], root: string): File[] {
  return creates.filter((file) => !fs.existsSync(path.join(root, file.path)));
}

export async function generate(options: Options) {
  const logger = getLogger(options);
  const modifies: File[] = [];

  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info("Modifying vite.config");
  const viteConfigPath =
    probeFirstExisting(options.root, VITE_CONFIG_CANDIDATES) ??
    path.join(options.root, VITE_CONFIG_CANDIDATES[0]);
  pushResult(
    modifyOutcomeToFile(viteConfigPath, modifyViteConfig(viteConfigPath)),
  );

  logger.info("Modifying src/routes/+layout.server.ts");
  const layoutServerPath = path.join(
    options.root,
    "src",
    "routes",
    "+layout.server.ts",
  );
  const locale = options.features.i18n ? WUCHALE_LOCALE : DEFAULT_LOCALE;
  pushResult(
    modifyOutcomeToFile(
      layoutServerPath,
      modifyLayoutServer(layoutServerPath, locale),
    ),
  );

  logger.info("Modifying src/routes/+layout.svelte");
  const layoutSveltePath = path.join(
    options.root,
    "src",
    "routes",
    "+layout.svelte",
  );
  pushResult(
    modifyOutcomeToFile(layoutSveltePath, modifyLayoutSvelte(layoutSveltePath)),
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
