import type { Options, Result } from "../../../core/types";
import type { EnvEdit } from "../../../runtime/env";
import { allProviderPaths } from "../../../core/providers";
import { appRelativePath } from "../../../core/util";
import { toDeleteEntry } from "../../destroy/shared";
import {
  DEMO_DIR,
  demoDir,
  envEditsFor,
  PACKAGES,
  PROVIDER_PACKAGES,
  PROVIDERS,
} from "../../enable/ai/generate";

const createsRaw = import.meta.glob<string>("../../enable/ai/creates/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const createsAppModeRaw = import.meta.glob<string>(
  "../../enable/ai/creates-app-mode/**",
  { query: "?raw", import: "default", eager: true },
);

const providersRaw = import.meta.glob<string>("../../enable/ai/providers/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

type DemoOptions = Pick<Options, "features" | "routeGroups">;

/**
 * Where enable-ai may have put the demo page in this project: the group it
 * picks with auth on and with it off. Auth enabled after AI leaves the page
 * in the public group, so both are candidates.
 */
export function demoDirs(options: DemoOptions): string[] {
  const dirs = [false, true].map((auth) =>
    demoDir({ ...options, features: { ...options.features, auth } }),
  );
  return [...new Set(dirs)];
}

/** A path enable-ai writes, with the stored demo directory moved to `dir`. */
function atDemoDir(path: string, dir: string): string {
  return path.startsWith(DEMO_DIR)
    ? `${dir}/${path.slice(DEMO_DIR.length)}`
    : path;
}

/**
 * Every path enable-ai writes for this project: the model module, the
 * endpoint and its test, and the demo page in its current default group.
 * `generate.runtime.ts` adds the page in the other group when it exists.
 */
export function aiPaths(options: DemoOptions): string[] {
  const dir = demoDir(options);
  const paths = new Set<string>(allProviderPaths(providersRaw));
  for (const [raw, prefix] of [
    [createsRaw, "../../enable/ai/creates/"],
    [createsAppModeRaw, "../../enable/ai/creates-app-mode/"],
  ] as const) {
    for (const key of Object.keys(raw)) {
      paths.add(atDemoDir(appRelativePath(key, prefix), dir));
    }
  }
  return [...paths].sort();
}

/**
 * The `.env` lines every provider writes. Which provider was chosen is not
 * recorded, so all are removed; keys that are not there are skipped.
 */
export function allEnvEdits(): EnvEdit[] {
  return PROVIDERS.flatMap((provider) => envEditsFor(provider));
}

export async function generate(options: Options) {
  return {
    creates: [],
    modifies: [],
    // Missing ones are skipped, and emptied directories (api/chat, ai) go too.
    deletes: aiPaths(options).map(toDeleteEntry),
    components: [],
    packages: [],
    // zod and the shadcn button/textarea stay: other code uses them.
    uninstalls: [...PACKAGES, ...Object.values(PROVIDER_PACKAGES).flat()],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
