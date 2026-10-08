import type { Options, Result } from "../../../core/types";
import { filesFromGlob } from "../../../core/util";

// The base login and signup pages with WhatsApp, as `enable whatsapp` writes
// them over the stock enable-auth ones.
const previewRaw = import.meta.glob<string>("./templates/base/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

export async function generate(_options: Options) {
  const modifies = Object.values(
    filesFromGlob(previewRaw, "./templates/base/"),
  ).sort((a, b) => a.path.localeCompare(b.path));

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
