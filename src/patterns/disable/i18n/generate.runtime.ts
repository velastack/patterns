import fs from "node:fs";
import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { languageFromPath } from "../../../core/util";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import {
  probeFirstExisting,
  VITE_CONFIG_CANDIDATES,
} from "../../../runtime/config-target";
import { toDeleteEntry } from "../../destroy/shared";
import { unmodifyGitignore } from "./modifies/gitignore";
import { unmodifyViteConfig } from "./modifies/vite-config";
import { unmodifySvelteConfig } from "./modifies/svelte-config";
import { unmodifyHooksServerI18n } from "./modifies/hooks.server";
import { unmodifyAppHtml } from "./modifies/app-html";
import { planRootLayoutRevert } from "./modifies/+layout";
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
  const hooksRevert = unmodifyHooksServerI18n(hooksServerPath);
  if (
    hooksRevert.status === "success" &&
    hooksRevert.changed &&
    fs.readFileSync(hooksServerPath, "utf8").trim() === ""
  ) {
    // enable-i18n created it; nothing else ever went in.
    deletes.push(toDeleteEntry(hooksServerPath));
  } else {
    pushResult(modifyOutcomeToFile(hooksServerPath, hooksRevert));
  }

  logger.info("Reverting app.html");
  const appHtmlPath = path.join(options.root, "src", "app.html");
  pushResult(modifyOutcomeToFile(appHtmlPath, unmodifyAppHtml(appHtmlPath)));

  logger.info("Reverting root +layout.ts");
  const layoutPath = path.join(options.root, "src", "routes", "+layout.ts");
  const layoutRevert = planRootLayoutRevert(layoutPath);
  if (layoutRevert.action === "delete") {
    deletes.push(toDeleteEntry(layoutPath));
  } else if (layoutRevert.action === "failed") {
    modifies.push({
      path: layoutPath,
      language: languageFromPath(layoutPath),
      content: fs.readFileSync(layoutPath, "utf8"),
      status: "failed",
      message: layoutRevert.message,
    });
  }

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
