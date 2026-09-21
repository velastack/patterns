import fs from "node:fs";
import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import {
  modifyOutcomeToFile,
  revertOutcomeToFile,
} from "../../../runtime/modify-file";
import {
  probeFirstExisting,
  VITE_CONFIG_CANDIDATES,
} from "../../../runtime/config-target";
import { unmodifyGitignore } from "./modifies/gitignore";
import { unmodifyViteConfig } from "./modifies/vite-config";
import { unmodifySvelteConfig } from "./modifies/svelte-config";
import { unmodifyHooksServerI18n } from "./modifies/hooks.server";
import { unmodifyHooksI18n } from "./modifies/hooks";
import { unmodifyAppHtml } from "./modifies/app-html";
import { unmodifyRootLayoutI18n } from "./modifies/+layout";
import { unmodifyRootLayoutLanguageSelect } from "./modifies/root-layout.svelte";

export async function generate(options: Options) {
  const logger = getLogger(options);
  const modifies: File[] = [];
  const deletes: File[] = [];
  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info("Reverting vite.config");
  const viteConfigPath =
    probeFirstExisting(options.root, VITE_CONFIG_CANDIDATES) ??
    path.join(options.root, VITE_CONFIG_CANDIDATES[0]);
  pushResult(
    modifyOutcomeToFile(viteConfigPath, unmodifyViteConfig(viteConfigPath)),
  );

  logger.info("Reverting the $locales alias");
  const alias = unmodifySvelteConfig(options.root);
  pushResult(modifyOutcomeToFile(alias.filePath, alias.outcome));

  logger.info("Reverting hooks.server.ts");
  const hooksServerPath = path.join(options.root, "src", "hooks.server.ts");
  // enable-i18n may have created it; emptied, it goes.
  const hooksServerRevert = revertOutcomeToFile(
    hooksServerPath,
    unmodifyHooksServerI18n(hooksServerPath),
  );
  pushResult(hooksServerRevert.modify);
  if (hooksServerRevert.delete) deletes.push(hooksServerRevert.delete);

  logger.info("Reverting hooks.ts");
  const hooksPath = path.join(options.root, "src", "hooks.ts");
  // The de-localizing reroute may be all it holds; emptied, it goes.
  const hooksRevert = revertOutcomeToFile(
    hooksPath,
    unmodifyHooksI18n(hooksPath),
  );
  pushResult(hooksRevert.modify);
  if (hooksRevert.delete) deletes.push(hooksRevert.delete);

  logger.info("Reverting app.html");
  const appHtmlPath = path.join(options.root, "src", "app.html");
  pushResult(modifyOutcomeToFile(appHtmlPath, unmodifyAppHtml(appHtmlPath)));

  logger.info("Reverting root +layout.ts");
  const layoutPath = path.join(options.root, "src", "routes", "+layout.ts");
  // enable-i18n may have written the whole file; emptied, it goes.
  const layoutRevert = revertOutcomeToFile(
    layoutPath,
    unmodifyRootLayoutI18n(layoutPath),
  );
  pushResult(layoutRevert.modify);
  if (layoutRevert.delete) deletes.push(layoutRevert.delete);

  logger.info("Reverting root layout language select");
  const rootLayoutCandidates = [
    path.join(options.root, "src", "routes", "(public)", "root-layout.svelte"),
    path.join(options.root, "src", "routes", "root-layout.svelte"),
    path.join(options.root, "src", "routes", "(public)", "+layout.svelte"),
    path.join(options.root, "src", "routes", "+layout.svelte"),
  ];
  for (const candidate of rootLayoutCandidates) {
    if (!fs.existsSync(candidate)) continue;
    pushResult(
      modifyOutcomeToFile(
        candidate,
        unmodifyRootLayoutLanguageSelect(candidate),
      ),
    );
  }

  logger.info("Reverting .gitignore");
  const gitignorePath = path.join(options.root, ".gitignore");
  pushResult(
    modifyOutcomeToFile(gitignorePath, unmodifyGitignore(gitignorePath)),
  );

  return {
    creates: [],
    modifies,
    deletes,
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
