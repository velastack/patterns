import type { Options, Result } from "../../../core/types";
import { filesFromGlob } from "../../../core/util";

const previewRaw = import.meta.glob<string>("./preview-modifies/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** The files enable-orders changes, in their final state, for the preview. */
export async function generate(_options: Options) {
  return {
    creates: [],
    modifies: Object.values(
      filesFromGlob(previewRaw, "./preview-modifies/"),
    ).sort((a, b) => a.path.localeCompare(b.path)),
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
