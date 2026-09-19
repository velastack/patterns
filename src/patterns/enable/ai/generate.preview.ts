import type { Options, Result } from "../../../core/types";
import { resolveProvider } from "../../../core/providers";
import { envEditsFor, META } from "./generate";

export async function generate(options: Options) {
  const provider = resolveProvider(META, options);

  // Same shape `applyEnvEdits` appends at runtime.
  const envLines = envEditsFor(provider).map((edit) =>
    edit.type === "comment" ? `# ${edit.key}` : `${edit.key}=${edit.value}`,
  );

  return {
    creates: [],
    modifies: [
      {
        path: ".env",
        language: "text",
        content: envLines.join("\n") + "\n",
        status: "success" as const,
      },
    ],
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
