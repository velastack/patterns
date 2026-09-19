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
  {
    id: "team-scoped-scaffold-server-tests",
    reason:
      "server.test.ts for a scaffold under a dynamic route is a placeholder (it carries a TODO to customize the params): the create action takes `owner` from `locals.team`, which the test never sets (no `team` cookie, `test_team_id` is not a team), and the records it leaves behind block the team fixture's cleanup. The generator has to learn current_team before these can pass. The record is the whole `vela test:server` run, so this also hides any other server-test failure in that step.",
    kind: "server-tests",
    step: "generate-scaffold",
    case: /^teams-scaffold-roundtrip$/,
    match: /\[team_id\]\/projects\/server\.test\.ts/,
  },
  {
    id: "bare-app-html-tabs",
    reason:
      "`sv create` indents app.html with tabs and the bare baseline has no prettier config, so prettier's defaults reject it once enable-i18n sets its `lang` placeholder. Patterns format ts/js/svelte output but leave .html as written. The case applies enable-i18n in both suites, so the rule is scoped to it.",
    kind: "prettier",
    step: "enable-i18n",
    case: /^(enable|disable)-i18n-plain$/,
    match: /src\/app\.html/,
  },
];
