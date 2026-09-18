import type { Options, Result } from "../../../core/types";
import { appRelativePath, languageFromPath } from "../../../core/util";
import { WORKFLOW_PACKAGES } from "../../enable/workflows/generate";

const createsRaw = import.meta.glob<string>("../../enable/backend/creates/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const CREATES_PREFIX = "../../enable/backend/creates/";

/**
 * Workflows run on PocketBase and their worker starts from hooks.server.ts, so
 * they go with the backend: the runtime, and the workflow modules that import
 * `ow` from it. Left behind they no longer type-check (`App.Locals["admin"]`).
 */
const WORKFLOW_PATHS = ["src/lib/server/workflows.ts", "src/lib/workflows"];

/** `openworkflow@^0.10.0` -> `openworkflow`, `@scope/name@1` -> `@scope/name`. */
function packageName(spec: string): string {
  const at = spec.lastIndexOf("@");
  return at > 0 ? spec.slice(0, at) : spec;
}

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
    .concat(
      ["data", ...WORKFLOW_PATHS].map((path) => ({
        path,
        language: languageFromPath(path),
        content: "",
        status: "success" as const,
      })),
    )
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    creates: [],
    modifies: [],
    deletes,
    components: [],
    // The adapter the config is switched back to, so the project still builds.
    packages: ["@sveltejs/adapter-static"],
    uninstalls: WORKFLOW_PACKAGES.map(packageName),
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
