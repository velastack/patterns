import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { bySlug, type Slug } from "../src/index";
import type { Features, Options, Result } from "../src/core/types";
import type { Collection } from "../src/parse/types";
import { withPocketbase } from "../src/runtime/pocketbase";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "./baseline";
import { appendLog } from "./exec";
import { detectFeatures } from "./features";
import type { Project } from "./project";

export type ErrorKind =
  "apply" | "collections" | "features" | "check" | "prettier" | "server-tests";

export interface ErrorRecord {
  kind: ErrorKind;
  /** Slug of the step the error belongs to; absent for baseline checks. */
  step?: string;
  message: string;
  /** The chain cannot continue after this error (the generator threw). */
  fatal?: boolean;
}

export interface StepInput {
  slug: Slug;
  /** Defaults to the pattern's own `command.argv` example. */
  argv?: string[];
  input?: Record<string, unknown>;
}

export interface StepOutcome {
  slug: Slug;
  argv: string[];
  result: Result | null;
  featuresBefore: Features;
  featuresAfter: Features;
  /** Successfully written creates + modifies, relative to the project root. */
  changedFiles: string[];
  errors: ErrorRecord[];
  durationMs: number;
}

export function stripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY,
  );
}

/**
 * The same provider the CLI injects (`velastack-cli/src/lib/pattern-runner.ts`):
 * spawn a throwaway PocketBase for the project and read its schema.
 */
export function makeGetCollections(root: string): () => Promise<Collection[]> {
  return async () => {
    const { getCollections } = await import("@velastack/pocketbase-codegen");
    let collections: Collection[] = [];
    await withPocketbase(root, async (pb) => {
      collections = (await getCollections(pb)) as unknown as Collection[];
    });
    return collections;
  };
}

/**
 * Inputs a user would supply through the CLI's flags and prompts. Destructive
 * patterns only write when told to, and the payments pattern needs Stripe keys.
 */
function defaultInput(slug: Slug): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  if (slug.startsWith("disable-") || slug.startsWith("destroy-")) {
    input.destructive = true;
  }
  if (slug === "enable-payments") {
    input.stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    input.stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
    input.stripeWebhookSecret =
      process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_integration";
    if (process.env.STRIPE_PRICE_ID) {
      input.stripePriceId = process.env.STRIPE_PRICE_ID;
    }
  }
  return input;
}

function relative(root: string, file: string): string {
  return path.isAbsolute(file) ? path.relative(root, file) : file;
}

/**
 * The patterns' own `withPocketbase` (`src/runtime/pocketbase.ts`) spawns
 * `pocketbase-server` from `process.cwd()` and reads the superuser credentials
 * from the environment, so both have to be set for the duration of a call.
 */
async function withProjectCwd<T>(
  root: string,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = process.cwd();
  process.chdir(root);
  try {
    return await fn();
  } finally {
    process.chdir(previous);
  }
}

export function ensurePocketbaseEnv(): void {
  process.env.POCKETBASE_SUPERUSER_EMAIL ??= ADMIN_EMAIL;
  process.env.POCKETBASE_SUPERUSER_PASSWORD ??= ADMIN_PASSWORD;
}

function recordStep(project: Project, outcome: StepOutcome): void {
  const file = path.join(project.logDir, "steps.json");
  const existing = existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")) as unknown[])
    : [];
  const withoutContent = (files: Result["creates"]) =>
    files.map(({ content: _content, ...rest }) => rest);
  existing.push({
    ...outcome,
    result: outcome.result && {
      ...outcome.result,
      creates: withoutContent(outcome.result.creates),
      modifies: withoutContent(outcome.result.modifies),
      deletes: withoutContent(outcome.result.deletes),
    },
  });
  writeFileSync(file, JSON.stringify(existing, null, 2));
}

/**
 * Applies one pattern to a project exactly as the CLI would: feature flags are
 * re-detected from disk, `getCollections` reads the live schema, and the
 * pattern itself writes files, installs packages and touches PocketBase.
 *
 * Nothing here throws for a pattern that only partially applied. Files a
 * modifier could not handle come back with `status: "failed" | "not-found"`
 * and become error records; a generator that throws is recorded as a fatal
 * error so the chain stops.
 */
export async function applyPattern(
  project: Project,
  step: StepInput,
): Promise<StepOutcome> {
  const pattern = bySlug[step.slug];
  if (!pattern) throw new Error(`Unknown pattern: ${step.slug}`);

  ensurePocketbaseEnv();
  const root = project.root;
  const argv = step.argv ?? pattern.command.argv;
  const input = { ...defaultInput(step.slug), ...step.input };
  const featuresBefore = detectFeatures(root);
  const getCollections = makeGetCollections(root);
  const errors: ErrorRecord[] = [];
  const startedAt = Date.now();

  appendLog(
    project.logFile,
    `\n### apply ${step.slug} ${argv.join(" ")}\n  features: ${JSON.stringify(featuresBefore)}\n  input: ${JSON.stringify(input)}\n`,
  );

  const options: Options = {
    argv,
    env: "runtime",
    root,
    features: featuresBefore,
    input,
    getCollections,
    logger: {
      info: (message) =>
        appendLog(project.logFile, `  [${step.slug}] ${message}\n`),
    },
  };

  let result: Result | null = null;
  try {
    result = await withProjectCwd(root, () => pattern.generate(options));
  } catch (error) {
    const message =
      error instanceof Error ? (error.stack ?? error.message) : String(error);
    errors.push({ kind: "apply", step: step.slug, message, fatal: true });
  }

  const changedFiles: string[] = [];
  if (result) {
    for (const bucket of ["creates", "modifies", "deletes"] as const) {
      for (const file of result[bucket]) {
        if (file.status !== "success") {
          errors.push({
            kind: "apply",
            step: step.slug,
            message: `${bucket} ${relative(root, file.path)}: ${file.status}${file.message ? ` — ${file.message}` : ""}`,
          });
        } else if (bucket !== "deletes") {
          changedFiles.push(relative(root, file.path));
        }
      }
    }

    const declared = result.collections.map((c) => c.name);
    if (declared.length > 0 && detectFeatures(root).backend) {
      try {
        const existing = new Set(
          (await withProjectCwd(root, getCollections)).map((c) => c.name),
        );
        for (const name of declared) {
          if (!existing.has(name)) {
            errors.push({
              kind: "collections",
              step: step.slug,
              message: `collection "${name}" is in the result but does not exist in PocketBase`,
            });
          }
        }
      } catch (error) {
        errors.push({
          kind: "collections",
          step: step.slug,
          message: `could not read collections: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }
  }

  const outcome: StepOutcome = {
    slug: step.slug,
    argv,
    result,
    featuresBefore,
    featuresAfter: detectFeatures(root),
    changedFiles,
    errors,
    durationMs: Date.now() - startedAt,
  };
  recordStep(project, outcome);
  return outcome;
}
