import type { Options, Result } from "../../../core/types";
import { resolveProvider } from "../../../core/providers";
import { filesFromGlob } from "../../../core/util";
import { META } from "./generate";

const previewRaw = import.meta.glob<string>("./preview-modifies/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

export async function generate(options: Options) {
  // The cart's files come from the base generator; the preview adds the
  // navbar change. A shop page is `generate-shop`'s.
  resolveProvider(META, options);

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
