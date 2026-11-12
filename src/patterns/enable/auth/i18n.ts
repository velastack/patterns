import fs from "node:fs";
import path from "node:path";
import type { File, Options } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import {
  entriesInProject,
  hasSpanish,
  translateCatalog,
} from "../../../runtime/wuchale-catalog";
import {
  APP_LAYOUT_PATH,
  modifyAppLayoutLanguageSelect,
} from "../i18n/modifies/app-layout.svelte";
import { AUTH_TRANSLATIONS } from "./translations";

/**
 * What enable-i18n would have done to the auth pages had they been in the
 * project when it ran: the language select in the signed-in layout, and the
 * pages' Spanish in the catalog. For enable-auth and enable-auth-remote, in a
 * project that already has i18n; nothing happens in one that does not.
 *
 * Reads the pages from disk, so it runs after the pattern's creates are
 * written. Detected by the files enable-i18n wrote rather than
 * `features.i18n`, so a project that dropped Spanish keeps its catalog as it
 * is.
 */
export function localizeAuthPages(options: Options): {
  creates: File[];
  modifies: File[];
} {
  const logger = getLogger(options);
  const creates: File[] = [];
  const modifies: File[] = [];
  if (!fs.existsSync(path.join(options.root, "wuchale.config.js"))) {
    return { creates, modifies };
  }

  logger.info("Adding the language select to the signed-in layout");
  const appLayoutFile = path.join(options.root, APP_LAYOUT_PATH);
  const select = modifyOutcomeToFile(
    appLayoutFile,
    modifyAppLayoutLanguageSelect(appLayoutFile),
  );
  if (select) modifies.push(select);

  if (hasSpanish(options.root)) {
    logger.info("Translating the sign-in pages into Spanish");
    const translated = translateCatalog(
      options.root,
      entriesInProject(options.root, AUTH_TRANSLATIONS),
    );
    if (translated.create) creates.push(translated.create);
    if (translated.modify) modifies.push(translated.modify);
  }

  return { creates, modifies };
}
