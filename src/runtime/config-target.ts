import fs from "node:fs";
import path from "node:path";
import {
  Project,
  QuoteKind,
  SyntaxKind,
  type CallExpression,
  type ObjectLiteralExpression,
  type SourceFile,
} from "ts-morph";
import type { ModifyOutcome } from "../core/types";
import { formatLikeSource } from "./ts-morph-helpers";

export const VITE_CONFIG_CANDIDATES = [
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.cjs",
];

/** SvelteKit 2's config files; SvelteKit 3 refuses to start with any of them. */
export const SVELTE_CONFIG_CANDIDATES = [
  "svelte.config.ts",
  "svelte.config.js",
  "svelte.config.mjs",
  "svelte.config.cjs",
];

/**
 * The message every pattern prints for a project still on SvelteKit 2's
 * `svelte.config.*`. SvelteKit 3 refuses to start with one, so editing it
 * would be pointless; the migration moves it into `vite.config.ts`.
 */
export const SVELTE_CONFIG_MESSAGE =
  "SvelteKit 3 no longer reads svelte.config.* — run `npx vela@^0.15 migrate sveltekit-3` to move it into vite.config.ts.";

/** SvelteKit 3 fails on a leftover `kit: {...}` inside the `sveltekit()` arg. */
export const KIT_NESTING_MESSAGE =
  "SvelteKit 3 reads its options at the top level of sveltekit({...}), not under `kit:` — run `npx vela@^0.15 migrate sveltekit-3` to move them.";

/**
 * Where SvelteKit 3 reads its configuration: the inline argument object of the
 * `sveltekit()` call in `vite.config.*`. The former `kit.*` options (adapter,
 * alias, experimental, paths, ...) sit at its top level, beside
 * `compilerOptions`, `preprocess` and `extensions`.
 */
export interface ConfigTarget {
  /** The file to add imports to and save. */
  sourceFile: SourceFile;
  /** Absolute path of the resolved file. */
  filePath: string;
  /** The `sveltekit()` arg object. */
  configObject: ObjectLiteralExpression;
  /** Full text captured before any mutation, for change detection. */
  originalText: string;
  /**
   * The `sveltekit()` call when resolving it added the `{}` arg; saving drops
   * that arg again while it is still empty.
   */
  addedArgTo?: CallExpression;
}

/** Why a config could not be resolved for editing. */
export type ConfigFailure =
  /** A `svelte.config.*` exists: a SvelteKit 2 project that needs migrating. */
  | "svelte-config"
  /** The `sveltekit()` arg still nests options under `kit:`. */
  | "kit-nesting"
  /** The `sveltekit()` arg is not an object literal (`sveltekit(config)`). */
  | "non-object-arg";

export type ResolveResult =
  | { status: "resolved"; target: ConfigTarget }
  | { status: "not-found"; message: string; filePath: string }
  | {
      status: "failed";
      reason: ConfigFailure;
      message: string;
      filePath: string;
    };

/** Result shape returned by every config modifier so call sites can build a File. */
export interface ConfigModifyResult {
  filePath: string;
  outcome: ModifyOutcome;
}

/** First candidate that exists under `root`, or null. */
export function probeFirstExisting(
  root: string,
  candidates: string[],
): string | null {
  for (const rel of candidates) {
    const abs = path.join(root, rel);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

function newProject(): Project {
  return new Project({
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
}

/**
 * Get the object-literal value of property `name` on `obj`, creating it as an
 * empty object if missing (or replacing a non-object initializer). Returns null
 * if the property can't be coerced to an object literal.
 */
export function getOrCreateObjectLiteralProperty(
  obj: ObjectLiteralExpression,
  name: string,
  initializer: string,
): ObjectLiteralExpression | null {
  const prop = obj.getProperty(name);
  if (!prop) {
    obj.addPropertyAssignment({ name, initializer });
    const added = obj.getProperty(name);
    if (!added || added.getKind() !== SyntaxKind.PropertyAssignment)
      return null;
    const init = (
      added as import("ts-morph").PropertyAssignment
    ).getInitializer();
    if (!init || init.getKind() !== SyntaxKind.ObjectLiteralExpression)
      return null;
    return init as ObjectLiteralExpression;
  }

  if (prop.getKind() !== SyntaxKind.PropertyAssignment) return null;
  const init = (prop as import("ts-morph").PropertyAssignment).getInitializer();
  if (!init) return null;
  if (init.getKind() !== SyntaxKind.ObjectLiteralExpression) {
    (prop as import("ts-morph").PropertyAssignment).setInitializer(initializer);
    const init2 = (
      prop as import("ts-morph").PropertyAssignment
    ).getInitializer();
    return init2 && init2.getKind() === SyntaxKind.ObjectLiteralExpression
      ? (init2 as ObjectLiteralExpression)
      : null;
  }

  return init as ObjectLiteralExpression;
}

/** Ensure `obj[name] === true`. Returns whether a change was made. */
export function ensureBooleanTrue(
  obj: ObjectLiteralExpression,
  name: string,
): boolean {
  const existing = obj.getProperty(name);
  if (!existing) {
    obj.addPropertyAssignment({ name, initializer: "true" });
    return true;
  }
  if (existing.getKind() !== SyntaxKind.PropertyAssignment) return false;
  const init = (
    existing as import("ts-morph").PropertyAssignment
  ).getInitializer();
  if (init?.getText() === "true") return false;
  (existing as import("ts-morph").PropertyAssignment).setInitializer("true");
  return true;
}

function findSveltekitCall(sourceFile: SourceFile): CallExpression | null {
  return (
    sourceFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .find((ce) => ce.getExpression().getText() === "sveltekit") ?? null
  );
}

/**
 * Resolve the `sveltekit()` arg in `vite.config.*` for editing:
 *   - any `svelte.config.*` → failed (`svelte-config`), even when the inline
 *     arg exists too: SvelteKit 3 refuses to start until it is gone;
 *   - an object arg with a `kit:` property → failed (`kit-nesting`);
 *   - an object arg → resolved;
 *   - a bare `sveltekit()` → `{}` is added and resolved;
 *   - any other arg → failed (`non-object-arg`);
 *   - no vite config, or no `sveltekit()` call in it → not-found.
 *
 * `hints.failed` is the message for a shape that can't be edited; the
 * `svelte-config` and `kit-nesting` failures always carry the migrate message.
 */
export function resolveConfigTarget(
  root: string,
  hints?: { notFound?: string; failed?: string },
): ResolveResult {
  const notFound = hints?.notFound ?? "Could not find a Vite config to modify.";
  const failed = hints?.failed ?? "Could not modify the Vite config.";

  const sveltePath = probeFirstExisting(root, SVELTE_CONFIG_CANDIDATES);
  if (sveltePath) {
    return {
      status: "failed",
      reason: "svelte-config",
      message: SVELTE_CONFIG_MESSAGE,
      filePath: sveltePath,
    };
  }

  const vitePath = probeFirstExisting(root, VITE_CONFIG_CANDIDATES);
  if (!vitePath) {
    return {
      status: "not-found",
      message: notFound,
      filePath: path.join(root, VITE_CONFIG_CANDIDATES[0]),
    };
  }

  const sourceFile = newProject().addSourceFileAtPath(vitePath);
  const originalText = sourceFile.getFullText();
  const call = findSveltekitCall(sourceFile);
  if (!call) {
    return { status: "not-found", message: notFound, filePath: vitePath };
  }

  const arg = call.getArguments()[0];
  if (!arg) {
    const created = call
      .addArgument("{}")
      .asKind(SyntaxKind.ObjectLiteralExpression);
    if (!created) {
      return {
        status: "failed",
        reason: "non-object-arg",
        message: failed,
        filePath: vitePath,
      };
    }
    return {
      status: "resolved",
      target: {
        sourceFile,
        filePath: vitePath,
        configObject: created,
        originalText,
        addedArgTo: call,
      },
    };
  }

  const configObject = arg.asKind(SyntaxKind.ObjectLiteralExpression);
  if (!configObject) {
    return {
      status: "failed",
      reason: "non-object-arg",
      message: failed,
      filePath: vitePath,
    };
  }
  if (configObject.getProperty("kit")) {
    return {
      status: "failed",
      reason: "kit-nesting",
      message: KIT_NESTING_MESSAGE,
      filePath: vitePath,
    };
  }
  return {
    status: "resolved",
    target: { sourceFile, filePath: vitePath, configObject, originalText },
  };
}

/**
 * Format, compare against the captured original, and save only if changed.
 * A `{}` that resolving added to a bare `sveltekit()` is taken out again when
 * nothing went into it, so a no-op edit reports unchanged.
 */
export function saveTarget(target: ConfigTarget): ModifyOutcome {
  if (target.addedArgTo && target.configObject.getProperties().length === 0) {
    target.addedArgTo.removeArgument(0);
  }
  formatLikeSource(target.sourceFile);
  const newText = target.sourceFile.getFullText();
  if (newText === target.originalText) {
    return { status: "success", changed: false };
  }
  target.sourceFile.saveSync();
  return { status: "success", changed: true };
}

/**
 * Resolve a config target and run `mutate` against it. Handles the
 * not-found/failed branches and change detection uniformly. `mutate` returns
 * `false` when the config shape can't be safely edited (→ failed).
 */
export function modifyConfig(
  root: string,
  hints: { notFound: string; failed: string },
  mutate: (target: ConfigTarget) => boolean,
): ConfigModifyResult {
  const res = resolveConfigTarget(root, hints);
  if (res.status !== "resolved") {
    return {
      filePath: res.filePath,
      outcome: { status: res.status, message: res.message },
    };
  }
  const ok = mutate(res.target);
  if (!ok) {
    return {
      filePath: res.target.filePath,
      outcome: { status: "failed", message: hints.failed },
    };
  }
  return { filePath: res.target.filePath, outcome: saveTarget(res.target) };
}
