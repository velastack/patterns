import type { Options, Result } from "../../../core/types";
import { languageFromPath } from "../../../core/util";

// Every file enable-whatsapp creates, in either form style.
const createsRaw = import.meta.glob<string>(
  [
    "../../enable/whatsapp/creates/**",
    "../../enable/whatsapp/creates-superforms/**",
    "../../enable/whatsapp/creates-remote/**",
  ],
  { query: "?raw", import: "default", eager: true },
);

const PREFIX = /^\.\.\/\.\.\/enable\/whatsapp\/creates(-superforms|-remote)?\//;

export async function generate(_options: Options) {
  const paths = new Set(
    Object.keys(createsRaw).map((key) => key.replace(PREFIX, "")),
  );

  const deletes = Array.from(paths)
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
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
