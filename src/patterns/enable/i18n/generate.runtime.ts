import fs from "node:fs";
import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { resolveUi } from "../../../core/field/ui";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import {
  probeFirstExisting,
  VITE_CONFIG_CANDIDATES,
} from "../../../runtime/config-target";
import { modifyViteConfig } from "./modifies/vite-config";
import { modifyPackageImportsI18n } from "./modifies/package-imports";
import { modifyHooksServerI18n } from "./modifies/hooks.server";
import { modifyHooksI18n } from "./modifies/hooks";
import { modifyAppHtml } from "./modifies/app-html";
import { modifyGitignore } from "./modifies/gitignore";
import { ensureRootLayoutI18n } from "./modifies/+layout";
import { modifyRootLayoutLanguageSelect } from "./modifies/root-layout.svelte";
import { welcomePageCatalog } from "./welcome-catalog";
import {
  TRANSLATED_LIB_FILES,
  withWuchaleJsFiles,
} from "../../../runtime/wuchale-config";

/**
 * The `wuchale.config.js` create, with the library modules that carry
 * visitor-facing text and already exist in the project (the WhatsApp order
 * message, say) listed for the js adapter. A pattern enabled later adds its
 * own module to the written config.
 */
export function withLibraryTexts(root: string, creates: File[]): File[] {
  const present = TRANSLATED_LIB_FILES.filter((file) =>
    fs.existsSync(path.join(root, file)),
  );
  if (present.length === 0) return creates;
  return creates.map((file) => {
    if (!file.path.endsWith("wuchale.config.js")) return file;
    const edited = withWuchaleJsFiles(file.content, present);
    return edited?.changed ? { ...file, content: edited.source } : file;
  });
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

  logger.info("Adding #locales to package.json imports");
  const imports = modifyPackageImportsI18n(options.root);
  pushResult(modifyOutcomeToFile(imports.filePath, imports.outcome));

  logger.info("Modifying hooks.server.ts");
  const hooksServerPath = path.join(options.root, "src", "hooks.server.ts");
  pushResult(
    modifyOutcomeToFile(
      hooksServerPath,
      modifyHooksServerI18n(hooksServerPath),
    ),
  );

  logger.info("Modifying hooks.ts");
  const hooksPath = path.join(options.root, "src", "hooks.ts");
  pushResult(modifyOutcomeToFile(hooksPath, modifyHooksI18n(hooksPath)));

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
  const ui = resolveUi(options);
  // With no layout at all, a plain project's not-found hint names the
  // +layout.svelte it would have rather than vela's root-layout.svelte.
  const rootLayoutPath =
    rootLayoutCandidates.find((p) => fs.existsSync(p)) ??
    (ui === "plain" ? rootLayoutCandidates[3] : rootLayoutCandidates[0]);
  pushResult(
    modifyOutcomeToFile(
      rootLayoutPath,
      modifyRootLayoutLanguageSelect(rootLayoutPath, ui),
    ),
  );

  logger.info("Updating .gitignore");
  const gitignorePath = path.join(options.root, ".gitignore");
  pushResult(
    modifyOutcomeToFile(gitignorePath, modifyGitignore(gitignorePath)),
  );

  const catalog = welcomePageCatalog(options.root, ui);
  if (catalog) logger.info("Translating the welcome page into Spanish");

  return {
    creates: catalog ? [catalog] : [],
    modifies,
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
