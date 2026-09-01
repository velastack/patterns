import { describe, expect, it } from "vitest";
import { patterns } from "../src/index";
import type { Pattern } from "../src/core/types";
import { allCases } from "./cases";
import { KNOWN_FAILURES } from "./known-failures";

/**
 * Cheap guard that runs everywhere (no `vela` needed): the case tables must
 * keep up with the registry, and known-failure rules must point at something.
 */
describe("integration case coverage", () => {
  const cases = allCases();
  const stepSlugs = new Set<string>(
    cases.flatMap(({ spec }) => spec.steps.map((s) => s.slug)),
  );
  const registry: Pattern[] = patterns;

  it("exercises every registered pattern", () => {
    const missing = registry
      .map((p) => p.slug)
      .filter((slug) => !stepSlugs.has(slug));
    expect(missing).toEqual([]);
  });

  it("exercises every pattern variant", () => {
    const missing: string[] = [];
    for (const pattern of registry) {
      for (const variant of pattern.variants ?? []) {
        const covered = cases.some(({ spec }) =>
          spec.steps.some(
            (s) => s.slug === pattern.slug && s.input?.variant === variant,
          ),
        );
        if (!covered) missing.push(`${pattern.slug}#${variant}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("uses unique case names within a suite", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const { suite, spec } of cases) {
      const key = `${suite}/${spec.name}`;
      if (seen.has(key)) duplicates.push(key);
      seen.add(key);
    }
    expect(duplicates).toEqual([]);
  });

  it("scopes every known-failure rule to an existing step or case", () => {
    const caseNames = cases.map(({ spec }) => spec.name);
    const problems: string[] = [];
    for (const rule of KNOWN_FAILURES) {
      if (!rule.step && !rule.case) {
        problems.push(`${rule.id}: needs a step or case scope`);
        continue;
      }
      if (rule.step && !stepSlugs.has(rule.step)) {
        problems.push(`${rule.id}: no case applies step ${rule.step}`);
      }
      if (rule.case && !caseNames.some((n) => rule.case!.test(n))) {
        problems.push(`${rule.id}: no case matches ${rule.case}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
