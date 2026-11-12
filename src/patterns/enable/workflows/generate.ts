import type { Options, Result } from "../../../core/types";
import { appRelativePath, languageFromPath } from "../../../core/util";
import { spec } from "../../../core/versions";

const createsRaw = import.meta.glob<string>("./creates/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const CREATES_PREFIX = "./creates/";

/**
 * The same three packages the base template lists. `openworkflow` is the
 * engine's client and worker, `openworkflow-pocketbase` its PocketBase
 * backend, and `croner` matches the cron expressions recurring workflows
 * export; none of them has runtime dependencies of its own.
 */
export const WORKFLOW_PACKAGES = [
  spec("openworkflow"),
  spec("openworkflow-pocketbase"),
  spec("croner"),
];

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
    packages: WORKFLOW_PACKAGES,
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
