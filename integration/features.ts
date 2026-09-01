import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Features } from "../src/core/types";

/**
 * Mirror of the CLI's feature detection.
 *
 * Source of truth: `velastack-cli/src/lib/workspace.ts` (`detectFeatures`,
 * plus the `isAppMode` / `isPaymentsMode` probes in `getWorkspace`). The CLI
 * has no programmatic API, so the rules are duplicated here on purpose: the
 * harness must hand patterns exactly the flags a user's `vela` would, because
 * that is what the stacking cases exercise. Keep the two in sync.
 */
export function detectFeatures(root: string): Features {
  const has = (rel: string) => existsSync(path.join(root, rel));
  const pkg = readPackageJson(path.join(root, "package.json"));
  const hasDep = (name: string) =>
    Boolean(pkg.dependencies?.[name] || pkg.devDependencies?.[name]);

  return {
    auth: has("src/routes/(app)"),
    api: has("src/routes/api"),
    apiKeys: has("src/routes/api/api-keys") || has("src/routes/(app)/api-keys"),
    backend: has("data"),
    i18n: has("src/lib/i18n") || has("messages"),
    teams: has("src/routes/(app)/teams") || has("src/lib/teams"),
    payments: has("src/routes/webhooks/stripe"),
    blog: hasDep("mdsvex"),
    contentNegotiation: hasDep("sveltekit-negotiate"),
  };
}

function readPackageJson(file: string): {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
} {
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, "utf8"));
}

/** Pattern slugs that, once applied, should flip a feature flag on. */
export const SLUG_TO_FEATURE: Partial<Record<string, keyof Features>> = {
  "enable-auth": "auth",
  "enable-auth-remote": "auth",
  "enable-api": "api",
  "enable-api-keys": "apiKeys",
  "enable-backend": "backend",
  "enable-i18n": "i18n",
  "enable-teams": "teams",
  "enable-payments": "payments",
  "enable-blog": "blog",
  "enable-content-negotiation": "contentNegotiation",
};

/**
 * What `detectFeatures` should report once `slug` has been applied.
 *
 * `enable-X` turns X on and `disable-X` turns it off. Patterns that only
 * build on a feature (generators, notifications, subscriptions) assert that
 * their prerequisite is still detected.
 */
export function expectedFeaturesAfter(slug: string): Partial<Features> {
  const enabled = SLUG_TO_FEATURE[slug];
  if (enabled) return { [enabled]: true };

  if (slug.startsWith("disable-")) {
    const feature = SLUG_TO_FEATURE[`enable-${slug.slice("disable-".length)}`];
    if (feature) return { [feature]: false };
  }

  if (slug === "enable-subscriptions") return { payments: true };
  if (slug === "enable-notifications") return { auth: true };
  return {};
}

export const ALL_FEATURES_OFF: Features = {
  auth: false,
  api: false,
  apiKeys: false,
  backend: false,
  i18n: false,
  teams: false,
  payments: false,
  blog: false,
  contentNegotiation: false,
};
