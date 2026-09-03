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
      /(\(auth\)\/(login|otp\/\[token\]|signup)\/\+page\.svelte.*ts\(2339\) Property '(message|password)' does not exist)|(settings\/\+page\.svelte.*ts\(2322\) Type '\{ name: string; type: "checkbox")/,
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

  // --- disable-* --------------------------------------------------------------
  {
    id: "disable-api-template-readme",
    reason:
      "The minimal template ships src/routes/api/README.md, which the CLI's detectFeatures reads " +
      "as `api: true`; disable-api only deletes what enable-api created, so api stays detected.",
    kind: "features",
    step: "disable-api",
    match: /expected api=false/,
  },
  {
    id: "disable-api-keys-unused-icon",
    reason:
      "disable-api-keys removes the API keys menu item from nav-user.svelte but leaves the " +
      "KeyRoundIcon import behind.",
    kind: "check",
    step: "disable-api-keys",
    match:
      /nav-user\.svelte.*'KeyRoundIcon' is declared but its value is never read/,
  },
  {
    id: "disable-backend-incomplete-revert",
    reason:
      "disable-backend switches vite.config.ts to @sveltejs/adapter-static without installing it, " +
      "leaves `locals.meta` usages in src/routes/+layout.server.ts although app.d.ts no longer " +
      "declares it, and leaves server.test.ts files that rely on the removed test/setup.ts context.",
    kind: "check",
    step: "disable-backend",
    match:
      /adapter-static|Property 'meta' does not exist on type 'Locals'|Property '(request|agent|user)' does not exist on type 'TestContext/,
  },
  {
    id: "disable-content-negotiation-hooks-enoent",
    reason:
      "src/patterns/disable/content-negotiation/modifies/hooks.ts deletes src/hooks.ts when the " +
      "reroute was its only content, and modifyOutcomeToFile then re-reads the deleted file.",
    kind: "apply",
    step: "disable-content-negotiation",
    match: /ENOENT.*src\/hooks\.ts/,
  },
  {
    id: "disable-content-negotiation-still-detected",
    reason:
      "disable-content-negotiation deletes what enable-content-negotiation created and reverts the " +
      "hooks and root layout but uninstalls nothing, so the sveltekit-negotiate dependency keeps " +
      "contentNegotiation detected afterwards. Only reached when src/hooks.ts has other content " +
      "(i18n on); otherwise disable-content-negotiation-hooks-enoent aborts the step first.",
    kind: "features",
    step: "disable-content-negotiation",
    match: /expected contentNegotiation=false/,
  },
  {
    id: "disable-i18n-manual-remediation",
    reason:
      "disable-i18n only reverts .gitignore and prints manual steps; the $locales imports in " +
      "src/hooks.server.ts and src/routes/+layout.ts, the language-select import in the root " +
      "layout and the wuchale Vite plugin stay behind, so the project no longer type-checks or " +
      "loads its config.",
    kind: "check",
    step: "disable-i18n",
    match: /\$locales\/|Config file not found|language-select\.svelte/,
  },
  {
    id: "disable-i18n-still-detected",
    reason:
      "disable-i18n deletes the files enable-i18n created, wuchale.config.js included, but " +
      "uninstalls nothing, so the wuchale dependency keeps i18n detected afterwards.",
    kind: "features",
    step: "disable-i18n",
    match: /expected i18n=false/,
  },
  {
    id: "disable-teams-drop-order",
    reason:
      "disable-teams drops team_invite_links, team_invites, team_memberships and teams but not " +
      "team_users, which still references teams, so PocketBase refuses the drop " +
      "(`Failed to delete collection probably due to existing reference in team_users`).",
    kind: "apply",
    step: "disable-teams",
    match: /Failed to delete collection/,
  },

  // --- stacks -----------------------------------------------------------------
  {
    id: "static-backend-auth-missing-deps",
    reason:
      "enable-auth on a static-template project turned backend expects the minimal template's " +
      "extras: sveltekit-flash-message is not installed and test/setup.ts (request/agent/user on " +
      "the vitest context) does not exist.",
    kind: "check",
    case: /^static-backend-auth$/,
    match:
      /sveltekit-flash-message|Property '(request|agent|user)' does not exist on type 'TestContext/,
  },
];
