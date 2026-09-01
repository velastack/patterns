import type { ErrorKind } from "./apply";

/**
 * Failures the harness is expected to hit until something is fixed.
 *
 * A rule downgrades matching error records to a visible skip instead of a
 * failure. It must be scoped by `step` and/or `case` so that, once the
 * underlying bug is fixed, the runner can flag the rule as stale ("no longer
 * reproduces") and it gets removed. Unrelated errors in the same case still
 * fail the case: rules match individual errors, not whole cases.
 */
export interface KnownFailure {
  id: string;
  reason: string;
  kind: ErrorKind;
  /** Only errors produced by this step. */
  step?: string;
  /** Only cases whose name matches. */
  case?: RegExp;
  match: RegExp;
}

export const KNOWN_FAILURES: KnownFailure[] = [
  // --- enable-auth / enable-auth-remote -------------------------------------
  {
    id: "auth-oauth-accounts-not-created",
    reason:
      "enable-auth lists the oauth_accounts collection in its result but never creates it: " +
      "src/patterns/enable/auth/index.ts only calls writeResult, which ignores result.collections.",
    kind: "collections",
    step: "enable-auth",
    match: /collection "oauth_accounts"/,
  },
  {
    id: "auth-remote-oauth-accounts-not-created",
    reason:
      "Same as auth-oauth-accounts-not-created, for the remote-functions variant.",
    kind: "collections",
    step: "enable-auth-remote",
    match: /collection "oauth_accounts"/,
  },
  {
    id: "auth-remote-form-field-types",
    reason:
      "enable-auth-remote's login/otp/signup pages read `.message` / `.password` off a union of " +
      "remote form fields that TypeScript narrows to never, and the settings page passes " +
      '`type: "checkbox"` to a Checkbox root that does not accept it.',
    kind: "check",
    step: "enable-auth-remote",
    match:
      /(\(auth\)\/(login|otp|signup)\/\+page\.svelte.*ts\(2339\) Property '(message|password)' does not exist)|(settings\/\+page\.svelte.*ts\(2322\) Type '\{ name: string; type: "checkbox")/,
  },

  // --- enable-backend (static template) -------------------------------------
  {
    id: "backend-static-test-setup-missing",
    reason:
      "enable-backend modifies test/setup.ts, which the static template does not ship; " +
      "neither the pattern nor `vela enable backend` creates it.",
    kind: "apply",
    step: "enable-backend",
    match: /test\/setup\.ts/,
  },
  {
    id: "backend-adapter-auto-not-installed",
    reason:
      "enable-backend rewrites vite.config.ts to import @sveltejs/adapter-auto but its " +
      "packages list does not install it, so the config (and every .svelte file) fails to load.",
    kind: "check",
    step: "enable-backend",
    match: /adapter-auto/,
  },

  // --- enable-blog ------------------------------------------------------------
  {
    id: "blog-unused-imports",
    reason:
      "src/patterns/enable/blog/creates: blog/+page.svelte imports Badge and " +
      "blog/[slug]/+page.svelte imports Breadcrumb and declares breadcrumbs without using them.",
    kind: "check",
    step: "enable-blog",
    match:
      /'(Badge|Breadcrumb|breadcrumbs)' is declared but its value is never read/,
  },

  // --- enable-i18n ------------------------------------------------------------
  {
    id: "i18n-app-html-lang",
    reason:
      "src/patterns/enable/i18n/modifies/app-html.ts refuses to touch an <html> tag that already " +
      'has a lang attribute; the minimal template ships lang="en", so the placeholder is never set.',
    kind: "apply",
    step: "enable-i18n",
    match: /src\/app\.html/,
  },
  {
    id: "i18n-not-detected",
    reason:
      "The CLI's detectFeatures (velastack-cli/src/lib/workspace.ts) looks for src/lib/i18n or " +
      "messages/; enable-i18n creates wuchale.config.js, so later patterns never see i18n: true.",
    kind: "features",
    step: "enable-i18n",
    match: /expected i18n=true/,
  },

  // --- enable-teams -----------------------------------------------------------
  {
    id: "teams-page-spread-types",
    reason:
      "src/patterns/enable/teams/creates: teams/+page.ts and teams/[id]/+page.ts spread a value " +
      "TypeScript cannot prove is an object (ts 2698).",
    kind: "check",
    step: "enable-teams",
    match:
      /teams\/.*\+page\.ts.*Spread types may only be created from object types/,
  },
  {
    id: "teams-unused-locals",
    reason:
      "src/patterns/enable/teams/creates: teams/[id]/+page.server.ts declares an unused `user`, " +
      "and teams/[id]/server.test.ts imports an unused TestContext.",
    kind: "check",
    step: "enable-teams",
    match:
      /teams\/\[id\]\/.*'(user|TestContext)' is declared but its value is never read/,
  },
];
