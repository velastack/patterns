import type { Options, Result } from "../../../core/types";
import { appRelativePath, languageFromPath } from "../../../core/util";

const createsRaw = import.meta.glob<string>(
  "../../enable/api/creates/**",
  { query: "?raw", import: "default", eager: true },
);

const CREATES_PREFIX = "../../enable/api/creates/";

export async function generate(_options: Options) {
  const deletes = Object.keys(createsRaw)
    .map((key) => {
      const path = appRelativePath(key, CREATES_PREFIX);
      return {
        path,
        language: languageFromPath(path),
        content: "",
        status: "success" as const,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    creates: [],
    modifies: [],
    deletes,
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
