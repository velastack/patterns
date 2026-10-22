import type { File, Options, Result } from "../../../core/types";
import { allProviderPaths } from "../../../core/providers";
import { filesFromGlob, languageFromPath } from "../../../core/util";
import { PROVIDERS } from "../../enable/ecommerce/generate";

const createsRaw = import.meta.glob<string>(
  "../../enable/ecommerce/creates/**",
  { query: "?raw", import: "default", eager: true },
);

const providersRaw = import.meta.glob<string>(
  [
    "../../enable/ecommerce/providers/**",
    "../../enable/ecommerce/providers-app-mode/**",
  ],
  { query: "?raw", import: "default", eager: true },
);

// The demo shop page carries the item's id, so it is in no template tree.
const DEMO_PAGES = [
  "src/routes/(public)/shop/+page.server.ts",
  "src/routes/(public)/shop/+page.svelte",
];

export async function generate(options: Options) {
  // The cart follows the payments provider; with payments already gone,
  // every provider's files are removed, and the missing ones skipped.
  const detected = options.providers?.payments;
  const providers = PROVIDERS.some((provider) => provider.id === detected)
    ? [detected]
    : PROVIDERS.map((provider) => provider.id);

  const paths = new Set([
    ...Object.keys(
      filesFromGlob(createsRaw, "../../enable/ecommerce/creates/"),
    ),
    ...providers.flatMap((id) => allProviderPaths(providersRaw, id)),
    ...DEMO_PAGES,
  ]);

  const deletes: File[] = [...paths].sort().map((path) => ({
    path,
    language: languageFromPath(path),
    content: "",
    status: "success",
  }));

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
