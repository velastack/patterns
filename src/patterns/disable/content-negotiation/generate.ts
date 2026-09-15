import type { Options, Result } from "../../../core/types";
import { appRelativePath, languageFromPath } from "../../../core/util";

const createsRaw = import.meta.glob<string>(
  "../../enable/content-negotiation/creates/**",
  { query: "?raw", import: "default", eager: true },
);

// With blog on, enable-content-negotiation (or enable-blog after it) writes
// a negotiating blog post loader; it only exists because negotiation did.
const createsWithBlogRaw = import.meta.glob<string>(
  "../../enable/content-negotiation/creates-with-blog/**",
  { query: "?raw", import: "default", eager: true },
);

const CREATES_PREFIX = "../../enable/content-negotiation/creates/";
const CREATES_WITH_BLOG_PREFIX =
  "../../enable/content-negotiation/creates-with-blog/";

export async function generate(_options: Options) {
  const paths = [
    ...Object.keys(createsRaw).map((key) =>
      appRelativePath(key, CREATES_PREFIX),
    ),
    ...Object.keys(createsWithBlogRaw).map((key) =>
      appRelativePath(key, CREATES_WITH_BLOG_PREFIX),
    ),
  ];
  const deletes = [...new Set(paths)]
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
    // What enable-content-negotiation installed; the CLI detects the feature
    // by this dependency, so disabling has to remove it.
    uninstalls: ["sveltekit-negotiate"],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
