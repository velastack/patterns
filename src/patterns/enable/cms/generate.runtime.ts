import fs from "node:fs";
import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import {
  probeFirstExisting,
  VITE_CONFIG_CANDIDATES,
} from "../../../runtime/config-target";
import { resolveMode, type CmsMode } from "./generate";
import { modifyViteConfig } from "./modifies/vite-config";
import {
  DEFAULT_LOCALE,
  WUCHALE_LOCALE,
  modifyLayoutServer,
} from "./modifies/layout.server";
import { modifyLayoutUniversal } from "./modifies/layout";
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

/** The locale list from `wuchale.config.js`, or null when it cannot be read. */
export function readWuchaleLocales(root: string): string[] | null {
  const configPath = path.join(root, "wuchale.config.js");
  if (!fs.existsSync(configPath)) return null;
  const match = fs
    .readFileSync(configPath, "utf8")
    .match(/locales:\s*\[([^\]]*)\]/);
  if (!match) return null;
  const locales = [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
  return locales.length > 0 ? locales : null;
}

/**
 * Arguments for the `cms()` Vite plugin.
 *
 * A hosted CMS needs the endpoint and locales at build time so media can be
 * downloaded into the prerendered site. An app hosting the backend itself
 * needs nothing: the media steps are no-ops without an endpoint.
 */
export function vitePluginArgs(mode: CmsMode, locales: string[]): string {
  if (mode.local) return "";
  const list = locales.map((locale) => `'${locale}'`).join(", ");
  return `{ endpoint: '${mode.endpoint}', locales: [${list}] }`;
}

export async function generate(options: Options) {
  const logger = getLogger(options);
  const modifies: File[] = [];
  const mode = resolveMode(options);
  const i18n = options.features.i18n;

  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info("Modifying vite.config");
  const viteConfigPath =
    probeFirstExisting(options.root, VITE_CONFIG_CANDIDATES) ??
    path.join(options.root, VITE_CONFIG_CANDIDATES[0]);
  const locales = (i18n && readWuchaleLocales(options.root)) || ["en"];
  pushResult(
    modifyOutcomeToFile(
      viteConfigPath,
      modifyViteConfig(viteConfigPath, vitePluginArgs(mode, locales)),
    ),
  );

  logger.info("Modifying src/routes/+layout.server.ts");
  const layoutServerPath = path.join(
    options.root,
    "src",
    "routes",
    "+layout.server.ts",
  );
  const locale = i18n ? WUCHALE_LOCALE : DEFAULT_LOCALE;
  pushResult(
    modifyOutcomeToFile(
      layoutServerPath,
      modifyLayoutServer(layoutServerPath, locale),
    ),
  );

  // A universal root layout has to pass the server load's data along, or
  // `cms` never reaches the page. The static template has one.
  logger.info("Modifying src/routes/+layout.ts");
  const layoutUniversalPath = path.join(
    options.root,
    "src",
    "routes",
    "+layout.ts",
  );
  pushResult(
    modifyOutcomeToFile(
      layoutUniversalPath,
      modifyLayoutUniversal(layoutUniversalPath),
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
