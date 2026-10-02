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
 * for, what `generate.runtime.ts` writes to `.env` and declares in
 * `src/env.ts` (`public: true`, since the browser reads them); the generated
 * component imports them from `$app/env/public` and stays inert while they
 * are blank.
 */
export const PROVIDERS: Provider[] = [
  {
    id: "plausible",
    label: "Plausible",
    env: [
      {
        key: "PUBLIC_PLAUSIBLE_DOMAIN",
        public: true,
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
        public: true,
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
        public: true,
        label: "PostHog project API key",
        placeholder: "phc_...",
      },
      {
        key: "PUBLIC_POSTHOG_HOST",
        public: true,
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
