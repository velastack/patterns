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
import { modifySvelteConfig } from "./modifies/svelte-config";
import { modifyHooksServerI18n } from "./modifies/hooks.server";
import { modifyAppHtml } from "./modifies/app-html";
import { modifyGitignore } from "./modifies/gitignore";
import { ensureRootLayoutI18n } from "./modifies/+layout";
import { modifyRootLayoutLanguageSelect } from "./modifies/root-layout.svelte";

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

  logger.info("Modifying config for i18n alias");
  const alias = modifySvelteConfig(options.root);
  pushResult(modifyOutcomeToFile(alias.filePath, alias.outcome));

  logger.info("Modifying hooks.server.ts");
  const hooksServerPath = path.join(options.root, "src", "hooks.server.ts");
  pushResult(
    modifyOutcomeToFile(
      hooksServerPath,
      modifyHooksServerI18n(hooksServerPath),
    ),
  );

  logger.info("Modifying app.html");
  const appHtmlPath = path.join(options.root, "src", "app.html");
  pushResult(modifyOutcomeToFile(appHtmlPath, modifyAppHtml(appHtmlPath)));

  logger.info("Modifying root +layout.ts");
  const layoutPath = path.join(options.root, "src", "routes", "+layout.ts");
  pushResult(modifyOutcomeToFile(layoutPath, ensureRootLayoutI18n(layoutPath)));

  logger.info("Modifying root layout language select");
  const rootLayoutCandidates = [
    path.join(options.root, "src", "routes", "(public)", "root-layout.svelte"),
    path.join(options.root, "src", "routes", "root-layout.svelte"),
    path.join(options.root, "src", "routes", "(public)", "+layout.svelte"),
    path.join(options.root, "src", "routes", "+layout.svelte"),
  ];
  const rootLayoutPath =
    rootLayoutCandidates.find((p) => fs.existsSync(p)) ??
    rootLayoutCandidates[0];
  pushResult(
    modifyOutcomeToFile(
      rootLayoutPath,
      modifyRootLayoutLanguageSelect(rootLayoutPath),
    ),
  );

  logger.info("Updating .gitignore");
  const gitignorePath = path.join(options.root, ".gitignore");
  pushResult(
    modifyOutcomeToFile(gitignorePath, modifyGitignore(gitignorePath)),
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
