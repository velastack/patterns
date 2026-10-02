import type { Options, Result } from "../../../core/types";
import { providerEnvVars, resolveProvider } from "../../../core/providers";
import { envVarsFile } from "../../../runtime/env-vars-file";
import { appRelativePath, languageFromPath } from "../../../core/util";
import { envEditsFor, META } from "./generate";

const previewRaw = import.meta.glob<string>("./preview-modifies/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const PREVIEW_PREFIX = "./preview-modifies/";

export async function generate(options: Options) {
  const provider = resolveProvider(META, options);

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

  // The declarations and `.env` lines depend on the provider, so they are
  // built rather than stored as fixtures. Same shapes the runtime writes.
  modifies.push({
    path: "src/env.ts",
    language: "ts",
    content: envVarsFile(providerEnvVars(provider)),
    status: "success" as const,
  });
  const envLines = envEditsFor(provider).map((edit) =>
    edit.type === "comment" ? `# ${edit.key}` : `${edit.key}=${edit.value}`,
  );
  modifies.push({
    path: ".env",
    language: "text",
    content: envLines.join("\n") + "\n",
    status: "success" as const,
  });

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
