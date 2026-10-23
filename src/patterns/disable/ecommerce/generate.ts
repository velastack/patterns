import type { File, Options, Result } from "../../../core/types";
import { allProviderPaths } from "../../../core/providers";
import { filesFromGlob, languageFromPath } from "../../../core/util";
import { PROVIDERS } from "../../enable/ecommerce/generate";
import { SHOP_PATHS } from "../../destroy/shop";

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
    // The shop pages import the cart, so they go with it (the demo page an
    // older enable-ecommerce wrote shares the listing's paths). The catalog
    // module is the developer's product list and stays; destroy-shop takes it.
    ...SHOP_PATHS.filter((path) => path !== "src/lib/catalog.ts"),
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
