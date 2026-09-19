import type { Options, Package, Provider, Result } from "../../../core/types";
import type { EnvEdit } from "../../../runtime/env";
import {
  providerCreates,
  providerEnvEdits,
  resolveProvider,
} from "../../../core/providers";

/** Every provider ships the same component, so the root layout mounts one path. */
export const COMPONENT_PATH = "src/lib/components/analytics/analytics.svelte";

/**
 * The providers in prompt order. Each one's `env` keys are what the CLI asks
 * for and what `generate.runtime.ts` writes to `.env`; the generated
 * component reads them through `$env/dynamic/public` and stays inert while
 * they are blank.
 */
export const PROVIDERS: Provider[] = [
  {
    id: "plausible",
    label: "Plausible",
    env: [
      {
        key: "PUBLIC_PLAUSIBLE_DOMAIN",
        label: "Plausible site domain",
        placeholder: "example.com",
      },
    ],
  },
  {
    id: "google",
    label: "Google Analytics",
    env: [
      {
        key: "PUBLIC_GA_MEASUREMENT_ID",
        label: "Google Analytics measurement ID",
        placeholder: "G-XXXXXXXXXX",
      },
    ],
  },
  {
    id: "posthog",
    label: "PostHog",
    env: [
      {
        key: "PUBLIC_POSTHOG_KEY",
        label: "PostHog project API key",
        placeholder: "phc_...",
      },
      {
        key: "PUBLIC_POSTHOG_HOST",
        label: "PostHog host",
        default: "https://us.i.posthog.com",
      },
    ],
  },
];

const PACKAGES: Record<string, Package[]> = {
  posthog: ["posthog-js"],
};

/** What `resolveProvider` needs; `index.ts` spreads the rest of the metadata. */
export const META = { slug: "enable-analytics", providers: PROVIDERS };

/** The `.env` lines for a provider, under a `# <Label> analytics` heading. */
export function envEditsFor(
  provider: Provider,
  supplied: Record<string, string> = {},
): EnvEdit[] {
  return providerEnvEdits(provider, `${provider.label} analytics`, supplied);
}

const providersRaw = import.meta.glob<string>("./providers/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

export async function generate(options: Options) {
  const provider = resolveProvider(META, options);

  return {
    creates: providerCreates(providersRaw, provider.id),
    modifies: [],
    deletes: [],
    components: [],
    packages: PACKAGES[provider.id] ?? [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
