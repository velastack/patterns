import type { Options, Result } from "../../../core/types";
import { appRelativePath, languageFromPath } from "../../../core/util";
import { TEAMS_PREVIEW_COLLECTIONS } from "./runtime/collections";

const previewRaw = import.meta.glob<string>("./preview-modifies/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const PREVIEW_PREFIX = "./preview-modifies/";

export async function generate(_options: Options) {
  const modifies = Object.entries(previewRaw)
    .map(([key, content]) => {
      const path = appRelativePath(key, PREVIEW_PREFIX);
      return {
        path,
        language: languageFromPath(path),
        content,
        status: "success" as const,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    creates: [],
    modifies,
    deletes: [],
    components: [],
    packages: [],
    collections: TEAMS_PREVIEW_COLLECTIONS,
    collectionPatches: [],
  } satisfies Result;
}
