import type { File, Options, Provider, Result } from "../../../core/types";
import { allProviderPaths } from "../../../core/providers";
import { languageFromPath } from "../../../core/util";
import { PROVIDERS } from "../../enable/payments/generate";

const providersRaw = import.meta.glob<string>(
  [
    "../../enable/payments/providers/**",
    "../../enable/payments/providers-app-mode/**",
  ],
  { query: "?raw", import: "default", eager: true },
);

// The demo page enable-payments writes at runtime (it carries the price or
// variant id), so it is in no template tree: without the payment components it
// would no longer build.
const DEMO_PAGE = "src/routes/(public)/payment/+page.svelte";

/**
 * The provider whose files to remove: the one detected, else every one.
 * Removing every provider's files is safe, since a missing path is skipped.
 */
export function providersToRemove(
  options: Pick<Options, "providers">,
): Provider[] {
  const detected = options.providers?.payments;
  const match = PROVIDERS.filter((provider) => provider.id === detected);
  return match.length > 0 ? match : PROVIDERS;
}

export async function generate(options: Options) {
  // Both the plain and the app-mode files go, whatever auth is now: auth may
  // have been turned on or off since payments was enabled.
  const paths = new Set([DEMO_PAGE]);
  for (const provider of providersToRemove(options)) {
    for (const path of allProviderPaths(providersRaw, provider.id)) {
      paths.add(path);
    }
  }

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
