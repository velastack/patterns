import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, it, type TestContext } from "vitest";
import { INTEGRATION_ROOT, createVelaProject } from "./baseline";
import { applyPattern, stripeConfigured, type ErrorRecord } from "./apply";
import { diagnosticKey, runChecks } from "./checks";
import { detectFeatures, expectedFeaturesAfter } from "./features";
import { KNOWN_FAILURES, type KnownFailure } from "./known-failures";
import {
  bootstrapSuperuser,
  cloneProject,
  i18nExtract,
  keepProjects,
  projectHandle,
  projectRoot,
  removeProject,
  sanitizeName,
  type Project,
} from "./project";
import type { BaselineName, CaseSpec, StepSpec } from "./cases";

export interface Baseline {
  name: BaselineName;
  root: string;
  /** Keys of every error diagnostic the baseline already has. */
  diagnostics: Set<string>;
  /** Problems found while building/checking the baseline itself. */
  errors: ErrorRecord[];
}

const baselines = new Map<string, Baseline>();

/**
 * Builds (once per suite and process) the project every case of that suite
 * starts from, and records its diagnostics so cases only report what they
 * introduced.
 */
export async function getBaseline(
  suite: string,
  name: BaselineName,
): Promise<Baseline> {
  const key = `${suite}/${name}`;
  const cached = baselines.get(key);
  if (cached) return cached;

  const root = projectRoot(suite, `.baseline-${name}`);
  const project = projectHandle(suite, `baseline-${name}`, root);
  const errors: ErrorRecord[] = [];
  let diagnostics: Set<string>;

  if (name === "auth") {
    const parent = await getBaseline(suite, "minimal");
    cloneProject(parent.root, project);
    const outcome = await applyPattern(project, { slug: "enable-auth" });
    errors.push(...outcome.errors);
    if (!outcome.errors.some((e) => e.fatal)) {
      const report = runChecks(project, "baseline", outcome.changedFiles, {
        baselineDiagnostics: parent.diagnostics,
      });
      errors.push(...report.errors.map((e) => ({ ...e, step: "enable-auth" })));
      diagnostics = new Set(report.diagnostics.map(diagnosticKey));
    } else {
      diagnostics = new Set(parent.diagnostics);
    }
  } else {
    rmSync(root, { recursive: true, force: true });
    mkdirSync(path.dirname(root), { recursive: true });
    // `vela create` insists on an empty directory, so the creation log lives
    // next to the project rather than inside it.
    const createLog = path.join(
      INTEGRATION_ROOT,
      sanitizeName(suite),
      `.baseline-${name}.create.log`,
    );
    rmSync(createLog, { force: true });
    createVelaProject(root, name, createLog);
    mkdirSync(project.logDir, { recursive: true });
    const report = runChecks(project, "baseline", []);
    errors.push(...report.errors);
    diagnostics = new Set(report.diagnostics.map(diagnosticKey));
  }

  const baseline: Baseline = { name, root, diagnostics, errors };
  baselines.set(key, baseline);
  return baseline;
}

export function disposeBaselines(suite: string): void {
  for (const [key, baseline] of baselines) {
    if (!key.startsWith(`${suite}/`)) continue;
    if (!keepProjects()) {
      rmSync(baseline.root, { recursive: true, force: true });
    }
    baselines.delete(key);
  }
}

/**
 * svelte-check and prettier look at the whole project, so a diagnostic caused
 * by one step surfaces at whichever later step runs the check. For those
 * kinds a rule's `step` means "the case applied this step"; for everything
 * else it is the step that produced the error.
 */
const PROJECT_WIDE_KINDS = new Set<ErrorRecord["kind"]>(["check", "prettier"]);

function ruleMatches(
  rule: KnownFailure,
  caseName: string,
  steps: StepSpec[],
  error: ErrorRecord,
): boolean {
  if (rule.kind !== error.kind) return false;
  if (rule.step) {
    const inChain = PROJECT_WIDE_KINDS.has(rule.kind)
      ? steps.some((s) => s.slug === rule.step)
      : rule.step === error.step;
    if (!inChain) return false;
  }
  if (rule.case && !rule.case.test(caseName)) return false;
  return rule.match.test(error.message);
}

function ruleTargets(
  rule: KnownFailure,
  caseName: string,
  steps: StepSpec[],
): boolean {
  if (!rule.case && !rule.step) return false;
  if (rule.case && !rule.case.test(caseName)) return false;
  if (rule.step && !steps.some((s) => s.slug === rule.step)) return false;
  return true;
}

function formatError(error: ErrorRecord): string {
  const where = error.step
    ? `[${error.kind} @ ${error.step}]`
    : `[${error.kind}]`;
  const lines = error.message.split("\n");
  return [
    `${where} ${lines[0]}`,
    ...lines.slice(1).map((l) => `    ${l}`),
  ].join("\n");
}

/**
 * Turns a case's collected errors into a verdict:
 * - unmatched errors fail the case (matched ones are listed as "known");
 * - only known errors: the case is skipped with the rule ids;
 * - no errors while a targeted rule expected some: the rule is stale, fail.
 */
function settle(
  ctx: TestContext,
  suite: string,
  caseName: string,
  steps: StepSpec[],
  errors: ErrorRecord[],
  project: Project | null,
): void {
  const matched = new Set<KnownFailure>();
  const unknown: ErrorRecord[] = [];
  const known: { rule: KnownFailure; error: ErrorRecord }[] = [];

  for (const error of errors) {
    const rule = KNOWN_FAILURES.find((r) =>
      ruleMatches(r, caseName, steps, error),
    );
    if (rule) {
      matched.add(rule);
      known.push({ rule, error });
    } else {
      unknown.push(error);
    }
  }

  const stale = KNOWN_FAILURES.filter(
    (rule) => !matched.has(rule) && ruleTargets(rule, caseName, steps),
  );

  if (unknown.length === 0 && stale.length === 0) {
    if (project && !keepProjects()) removeProject(project);
    if (known.length > 0) {
      ctx.skip(`known failures: ${[...matched].map((r) => r.id).join(", ")}`);
    }
    return;
  }

  const report = [
    `Case "${caseName}" (${suite}) failed.`,
    ...unknown.map((e) => `  ${formatError(e)}`),
    ...stale.map(
      (r) =>
        `  [stale known failure] ${r.id} no longer reproduces — remove it from integration/known-failures.ts`,
    ),
    ...(known.length > 0
      ? [
          "  known (ignored):",
          ...known.map(
            ({ rule, error }) => `    ${rule.id}: ${formatError(error)}`,
          ),
        ]
      : []),
    project
      ? `Project kept at ${project.root} (logs in ${project.logDir}).`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  throw new Error(report);
}

async function runCase(
  ctx: TestContext,
  suite: string,
  spec: CaseSpec,
): Promise<void> {
  if (spec.requires === "stripe" && !stripeConfigured()) {
    ctx.skip("STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY not set");
  }

  const baseline = await getBaseline(suite, spec.baseline);
  const project = projectHandle(
    suite,
    spec.name,
    projectRoot(suite, spec.name),
  );
  cloneProject(baseline.root, project);

  const errors: ErrorRecord[] = [];
  const changed: string[] = [];

  for (const [index, step] of spec.steps.entries()) {
    const outcome = await applyPattern(project, step);
    errors.push(...outcome.errors);
    changed.push(...outcome.changedFiles);
    if (outcome.errors.some((e) => e.fatal)) break;

    try {
      if (step.after === "bootstrapSuperuser") bootstrapSuperuser(project);
      if (step.after === "i18nExtract") i18nExtract(project);
    } catch (error) {
      errors.push({
        kind: "apply",
        step: step.slug,
        message: `${step.after} failed: ${error instanceof Error ? error.message : String(error)}`,
        fatal: true,
      });
      break;
    }

    const expected = step.expectFeatures ?? expectedFeaturesAfter(step.slug);
    const actual = detectFeatures(project.root);
    for (const [feature, value] of Object.entries(expected)) {
      const detected = actual[feature as keyof typeof actual];
      if (detected !== value) {
        errors.push({
          kind: "features",
          step: step.slug,
          message: `expected ${feature}=${value} to be detected after ${step.slug}, got ${detected}`,
        });
      }
    }

    const check = step.check ?? index === spec.steps.length - 1;
    if (check) {
      const report = runChecks(project, `${index + 1}-${step.slug}`, changed, {
        baselineDiagnostics: baseline.diagnostics,
      });
      errors.push(...report.errors.map((e) => ({ ...e, step: step.slug })));
    }
  }

  settle(ctx, suite, spec.name, spec.steps, errors, project);
}

const BASELINE_ORDER: BaselineName[] = ["minimal", "static", "auth"];

/** Registers one vitest `describe` per suite: baseline sanity tests first, then every case. */
export function defineSuite(suite: string, cases: CaseSpec[]): void {
  describe(suite, () => {
    const used = new Set(cases.map((c) => c.baseline));
    if (used.has("auth")) used.add("minimal");

    for (const name of BASELINE_ORDER.filter((n) => used.has(n))) {
      it(`baseline ${name} is clean`, async (ctx) => {
        const baseline = await getBaseline(suite, name);
        const steps: StepSpec[] =
          name === "auth" ? [{ slug: "enable-auth" }] : [];
        settle(ctx, suite, `baseline-${name}`, steps, baseline.errors, null);
      });
    }

    for (const spec of cases) {
      it(spec.name, (ctx) => runCase(ctx, suite, spec));
    }

    afterAll(() => disposeBaselines(suite));
  });
}
