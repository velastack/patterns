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
  // --- disable-* --------------------------------------------------------------
  {
    id: "disable-api-template-readme",
    reason:
      "The minimal template ships src/routes/api/README.md, which the CLI's detectFeatures reads " +
      "as `api: true`; disable-api only deletes what enable-api created, so api stays detected. " +
      "Fixed in the CLI (hasApiRoutes ignores the README) after 0.10.9; once VELA_VERSION in " +
      "ci.yml moves past that release, mirror it in integration/features.ts and drop this rule.",
    kind: "features",
    step: "disable-api",
    match: /expected api=false/,
  },
];
