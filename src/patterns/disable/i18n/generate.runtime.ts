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
import { unmodifyPrettierignore } from "./modifies/prettierignore";
import { unmodifyViteConfig } from "./modifies/vite-config";
import { unmodifyLocalesAlias } from "./modifies/locales-alias";
import { removePackageImports } from "../../../runtime/package-imports";
import { LOCALES_IMPORTS } from "../../enable/i18n/modifies/package-imports";
import { unmodifyHooksServerI18n } from "./modifies/hooks.server";
import { unmodifyHooksI18n } from "./modifies/hooks";
import { unmodifyAppHtml } from "./modifies/app-html";
import { unmodifyRootLayoutI18n } from "./modifies/+layout";
import { unmodifyRootLayoutLanguageSelect } from "./modifies/root-layout.svelte";
import { unmodifyLayoutServerLocale } from "./modifies/layout.server";
import { unmodifyAppDts } from "./modifies/app-d-ts";
import { unmodifyAppLayoutLanguageSelect } from "./modifies/app-layout.svelte";
import { APP_LAYOUT_PATH } from "../../enable/i18n/modifies/app-layout.svelte";

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

  logger.info("Removing #locales from package.json imports");
  // Only while it still maps where enable-i18n pointed it.
  const imports = removePackageImports(
    options.root,
    Object.keys(LOCALES_IMPORTS),
    LOCALES_IMPORTS,
  );
  pushResult(modifyOutcomeToFile(imports.filePath, imports.outcome));

  // A project enabled before SvelteKit 3 has the `$locales` alias instead,
  // moved into the sveltekit() arg by `vela migrate sveltekit-3`.
  logger.info("Reverting the legacy $locales alias");
  const alias = unmodifyLocalesAlias(options.root);
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

  logger.info("Reverting root +layout.server.ts");
  const layoutServerPath = path.join(
    options.root,
    "src",
    "routes",
    "+layout.server.ts",
  );
  // enable-i18n may have written the whole file; emptied, it goes.
  const layoutServerRevert = revertOutcomeToFile(
    layoutServerPath,
    unmodifyLayoutServerLocale(layoutServerPath),
  );
  pushResult(layoutServerRevert.modify);
  if (layoutServerRevert.delete) deletes.push(layoutServerRevert.delete);

  logger.info("Reverting app.d.ts");
  const appDtsPath = path.join(options.root, "src", "app.d.ts");
  pushResult(modifyOutcomeToFile(appDtsPath, unmodifyAppDts(appDtsPath)));

  logger.info("Reverting the signed-in layout language select");
  const appLayoutPath = path.join(options.root, APP_LAYOUT_PATH);
  pushResult(
    modifyOutcomeToFile(
      appLayoutPath,
      unmodifyAppLayoutLanguageSelect(appLayoutPath),
    ),
  );

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

  logger.info("Reverting .prettierignore");
  const prettierignorePath = path.join(options.root, ".prettierignore");
  pushResult(
    modifyOutcomeToFile(
      prettierignorePath,
      unmodifyPrettierignore(prettierignorePath),
    ),
  );

  // wuchale's loaders import the packages this uninstalls, and without the
  // .prettierignore block they would fail the project's lint. The catalogs
  // (.po) beside them are the translations, and stay.
  logger.info("Removing wuchale's loaders from src/locales");
  const localesDir = path.join(options.root, "src", "locales");
  if (fs.existsSync(localesDir)) {
    for (const entry of fs.readdirSync(localesDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
      deletes.push({
        path: path.join(localesDir, entry.name),
        language: "js",
        content: "",
        status: "success",
      });
    }
  }

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
