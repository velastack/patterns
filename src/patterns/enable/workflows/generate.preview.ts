import type { Options, Result } from "../../../core/types";
import { appRelativePath, languageFromPath } from "../../../core/util";
import { envVarsFile } from "../../../runtime/env-vars-file";
import { WORKFLOWS_ENV_VARS } from "./env-vars";

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
    .concat({
      // Built from the same declarations the runtime writes.
      path: "src/env.ts",
      language: languageFromPath("src/env.ts"),
      content: envVarsFile(WORKFLOWS_ENV_VARS),
      status: "success" as const,
    })
    .sort((a, b) => a.path.localeCompare(b.path));

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
