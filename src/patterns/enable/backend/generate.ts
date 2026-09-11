import type { Options, Result } from "../../../core/types";
import { appRelativePath, languageFromPath } from "../../../core/util";

const createsRaw = import.meta.glob<string>("./creates/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const CREATES_PREFIX = "./creates/";

export async function generate(_options: Options) {
  const creates = Object.entries(createsRaw)
    .map(([key, content]) => {
      const path = appRelativePath(key, CREATES_PREFIX);
      return {
        path,
        language: languageFromPath(path),
        content,
        status: "success" as const,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    creates,
    modifies: [],
    deletes: [],
    components: [],
    packages: [
      "@velastack/pocketbase",
      "@velastack/kit",
      "pocketbase-sveltekit",
      // The adapter the config is switched to has to be installed with it,
      // or the config fails to load and takes every .svelte file with it.
      "@sveltejs/adapter-node",
    ],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
