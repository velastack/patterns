import type { Options, Result } from "../../../core/types";
import { appRelativePath, languageFromPath } from "../../../core/util";

const createsRaw = import.meta.glob<string>("../../enable/i18n/creates/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const CREATES_PREFIX = "../../enable/i18n/creates/";
const WUCHALE_CACHE = "src/locales/.wuchale";

export async function generate(_options: Options) {
  const deletes = [
    ...Object.keys(createsRaw).map((key) =>
      appRelativePath(key, CREATES_PREFIX),
    ),
    // wuchale's compiled catalogs and proxies: a cache, and git-ignored only
    // while the feature is on.
    WUCHALE_CACHE,
  ]
    .map((path) => ({
      path,
      language: languageFromPath(path),
      content: "",
      status: "success" as const,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    creates: [],
    modifies: [],
    deletes,
    components: [],
    packages: [],
    // What enable-i18n installed; the CLI detects the feature by the wuchale
    // dependency, so disabling has to remove it.
    uninstalls: ["wuchale", "@wuchale/svelte"],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
