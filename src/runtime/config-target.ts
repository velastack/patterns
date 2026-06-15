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

export const VITE_CONFIG_CANDIDATES = [
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.cjs",
];

export const SVELTE_CONFIG_CANDIDATES = [
  "svelte.config.ts",
  "svelte.config.js",
  "svelte.config.mjs",
  "svelte.config.cjs",
];

export type ConfigKind = "svelte-config" | "vite-inline";

/**
 * A resolved place to read/write SvelteKit configuration. Either the default
 * export object of a `svelte.config.*` file, or the inline argument object of
 * the `sveltekit()` call inside a `vite.config.*` file.
 *
 * The only structural difference between the two is where kit-namespaced
 * settings (adapter, alias, experimental) live: under `config.kit` in
 * svelte.config, but flattened onto the `sveltekit()` arg in vite-inline.
 * `kitContainer()` papers over that; everything else (`compilerOptions`,
 * `preprocess`, `extensions`) sits at the root of `configObject` in both.
 */
export interface ConfigTarget {
  kind: ConfigKind;
  /** The file to add imports to and save. */
  sourceFile: SourceFile;
  /** Absolute path of the resolved file. */
  filePath: string;
  /** svelte.config default-export object OR the `sveltekit()` arg object. */
  configObject: ObjectLiteralExpression;
  /** Full text captured before any mutation, for change detection. */
  originalText: string;
  /** Object that owns kit-namespaced settings (adapter, alias, experimental). */
  kitContainer(): ObjectLiteralExpression | null;
}

export type ResolveResult =
  | { status: "resolved"; target: ConfigTarget }
  | { status: "not-found"; message: string; filePath: string }
  | { status: "failed"; message: string; filePath: string };

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
 * Resolve the config object exported as default — handles both
 * `export default { ... }` and `const config = { ... }; export default config`.
 */
export function getDefaultExportObject(
  sourceFile: SourceFile,
): ObjectLiteralExpression | null {
  const defaultExport = sourceFile.getExportAssignment(
    (ea) => !ea.isExportEquals(),
  );
  const exportedExpr = defaultExport?.getExpression();
  if (exportedExpr?.getKind() === SyntaxKind.ObjectLiteralExpression) {
    return exportedExpr as ObjectLiteralExpression;
  }
  if (exportedExpr?.getKind() === SyntaxKind.Identifier) {
    const ident = exportedExpr.getText();
    const varDecl = sourceFile.getVariableDeclaration(ident);
    const init = varDecl?.getInitializer();
    if (init?.getKind() === SyntaxKind.ObjectLiteralExpression) {
      return init as ObjectLiteralExpression;
    }
  }
  return null;
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

function makeViteTarget(
  sourceFile: SourceFile,
  filePath: string,
  configObject: ObjectLiteralExpression,
  originalText: string,
): ConfigTarget {
  return {
    kind: "vite-inline",
    sourceFile,
    filePath,
    configObject,
    originalText,
    // kit-namespaced settings are flattened onto the sveltekit() arg.
    kitContainer: () => configObject,
  };
}

function makeSvelteTarget(
  sourceFile: SourceFile,
  filePath: string,
  configObject: ObjectLiteralExpression,
  originalText: string,
): ConfigTarget {
  return {
    kind: "svelte-config",
    sourceFile,
    filePath,
    configObject,
    originalText,
    kitContainer: () =>
      getOrCreateObjectLiteralProperty(configObject, "kit", "{}"),
  };
}

/**
 * Resolve where SvelteKit config should be read/written, mirroring SvelteKit's
 * own resolution order:
 *   1. `vite.config.*` has a `sveltekit(<object>)` call with an inline arg → use it
 *      (svelte.config is ignored by Kit when this exists).
 *   2. else a `svelte.config.*` with a parseable default-export object → use it.
 *   3. else a bare `sveltekit()` in vite.config → create `{}` and use it (the new default).
 */
export function resolveConfigTarget(
  root: string,
  hints?: { notFound?: string; failed?: string },
): ResolveResult {
  const notFound =
    hints?.notFound ?? "Could not find a Svelte or Vite config to modify.";
  const failed = hints?.failed ?? "Could not modify the Svelte or Vite config.";

  // --- Inspect vite.config.* ---
  const vitePath = probeFirstExisting(root, VITE_CONFIG_CANDIDATES);
  let viteSourceFile: SourceFile | null = null;
  let viteOriginal = "";
  let sveltekitCall: CallExpression | null = null;
  let viteInlineArg: ObjectLiteralExpression | null = null;
  let viteNonObjectArg = false;

  if (vitePath) {
    viteSourceFile = newProject().addSourceFileAtPath(vitePath);
    viteOriginal = viteSourceFile.getFullText();
    sveltekitCall = findSveltekitCall(viteSourceFile);
    const arg = sveltekitCall?.getArguments()[0];
    if (arg) {
      if (arg.getKind() === SyntaxKind.ObjectLiteralExpression) {
        viteInlineArg = arg as ObjectLiteralExpression;
      } else {
        viteNonObjectArg = true;
      }
    }
  }

  // Rule 1: vite.config carries an inline object arg → target it.
  if (viteSourceFile && vitePath && viteInlineArg) {
    return {
      status: "resolved",
      target: makeViteTarget(
        viteSourceFile,
        vitePath,
        viteInlineArg,
        viteOriginal,
      ),
    };
  }

  // --- Inspect svelte.config.* ---
  const sveltePath = probeFirstExisting(root, SVELTE_CONFIG_CANDIDATES);
  let svelteSourceFile: SourceFile | null = null;
  let svelteOriginal = "";
  let svelteConfigObj: ObjectLiteralExpression | null = null;
  if (sveltePath) {
    svelteSourceFile = newProject().addSourceFileAtPath(sveltePath);
    svelteOriginal = svelteSourceFile.getFullText();
    svelteConfigObj = getDefaultExportObject(svelteSourceFile);
  }

  // Rule 2: svelte.config with a parseable config object → target it.
  if (svelteSourceFile && sveltePath && svelteConfigObj) {
    return {
      status: "resolved",
      target: makeSvelteTarget(
        svelteSourceFile,
        sveltePath,
        svelteConfigObj,
        svelteOriginal,
      ),
    };
  }

  // Rule 3: bare `sveltekit()` in vite.config → create `{}` arg and target it.
  if (viteSourceFile && vitePath && sveltekitCall) {
    if (viteNonObjectArg) {
      return { status: "failed", message: failed, filePath: vitePath };
    }
    const created = sveltekitCall
      .addArgument("{}")
      .asKind(SyntaxKind.ObjectLiteralExpression);
    if (!created) {
      return { status: "failed", message: failed, filePath: vitePath };
    }
    return {
      status: "resolved",
      target: makeViteTarget(viteSourceFile, vitePath, created, viteOriginal),
    };
  }

  // svelte.config exists but its shape is unparseable.
  if (sveltePath && !svelteConfigObj) {
    return { status: "failed", message: failed, filePath: sveltePath };
  }

  const reportPath =
    vitePath ?? sveltePath ?? path.join(root, VITE_CONFIG_CANDIDATES[0]);
  return { status: "not-found", message: notFound, filePath: reportPath };
}

/** Format, compare against the captured original, and save only if changed. */
export function saveTarget(target: ConfigTarget): ModifyOutcome {
  target.sourceFile.formatText();
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
