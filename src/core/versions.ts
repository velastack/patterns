import data from "./versions.json";

/**
 * The dependency ranges every vela project starts from, in one place:
 * `versions.json` beside this file.
 *
 * Three things read it. The patterns here install from it (`spec`). The vela
 * CLI's `minimal` and `static` templates, and the velastack-templates
 * baselines built on them, list the same ranges and each carry a test that
 * they still do. And `scripts/bump-versions.ts` keeps it current.
 *
 * So a version is changed here and nowhere else; the other copies follow it,
 * and their tests fail until they do.
 */
export const VERSIONS: Readonly<Record<string, string>> = data.packages;

/** Packages kept below their latest release on purpose, and why. */
export const VERSION_HOLDS: Readonly<
  Record<string, { reason: string; since: string }>
> = data.holds;

/** Packages whose range follows another project's rather than npm's latest. */
export const VERSION_TRACKS: Readonly<
  Record<string, { source: string; reason: string }>
> = data.tracks;

/** The install spec for a listed package: `spec("zod")` is `zod@^4.6.7`. */
export function spec(name: string): string {
  const range = VERSIONS[name];
  if (range === undefined) {
    throw new Error(
      `${name} is not in src/core/versions.json; add it there before installing it.`,
    );
  }
  return `${name}@${range}`;
}
