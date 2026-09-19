import type { Options, Result } from "../../../core/types";
import type { EnvEdit } from "../../../runtime/env";
import { allProviderPaths } from "../../../core/providers";
import { toDeleteEntry } from "../../destroy/shared";
import { envEditsFor, PROVIDERS } from "../../enable/analytics/generate";

const providersRaw = import.meta.glob<string>(
  "../../enable/analytics/providers/**",
  { query: "?raw", import: "default", eager: true },
);

/**
 * The `.env` lines every provider writes. The project only has one set, but
 * which one is not recorded anywhere, so all are removed; keys that are not
 * there are skipped.
 */
export function allEnvEdits(): EnvEdit[] {
  return PROVIDERS.flatMap((provider) => envEditsFor(provider));
}

export async function generate(_options: Options) {
  return {
    creates: [],
    modifies: [],
    // Every provider's files: missing ones are skipped, and the emptied
    // components/analytics directory goes with them.
    deletes: allProviderPaths(providersRaw).map(toDeleteEntry),
    components: [],
    packages: [],
    // PostHog's SDK; the other providers load a script and install nothing.
    uninstalls: ["posthog-js"],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
