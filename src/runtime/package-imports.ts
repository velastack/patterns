import fs from "node:fs";
import path from "node:path";
import type { ModifyOutcome } from "../core/types";

/**
 * Edits to the project's `package.json` that npm has no command for: the
 * `imports` map SvelteKit 3 resolves `#lib` (and `#locales`) through, and
 * `overrides`. The file is rewritten with the indentation and trailing
 * newline it had, and a key that already holds a different value is never
 * overwritten: it is the project's, and the outcome says what to change.
 */

export interface PackageJsonEditResult {
  filePath: string;
  outcome: ModifyOutcome;
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

/** An `overrides` value: a version, or nested overrides (npm's `"."` is the package itself). */
export type OverrideValue = string | { [key: string]: OverrideValue };

interface PackageFile {
  filePath: string;
  text: string;
  pkg: JsonObject;
  indent: string;
  eol: string;
  trailing: string;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPackage(root: string): PackageFile | PackageJsonEditResult {
  const filePath = path.join(root, "package.json");
  if (!fs.existsSync(filePath)) {
    return {
      filePath,
      outcome: { status: "not-found", message: "No package.json to edit." },
    };
  }
  const text = fs.readFileSync(filePath, "utf8");
  let pkg: unknown;
  try {
    pkg = JSON.parse(text);
  } catch {
    return {
      filePath,
      outcome: { status: "failed", message: "package.json is not valid JSON." },
    };
  }
  if (!isObject(pkg)) {
    return {
      filePath,
      outcome: { status: "failed", message: "package.json is not an object." },
    };
  }
  const indent = text.match(/^[{[][^\S\n]*\r?\n([\t ]+)\S/)?.[1] ?? "\t";
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const trailing = text.match(/(\r?\n)*$/)?.[0] ?? "";
  return { filePath, text, pkg, indent, eol, trailing };
}

function writePackage(file: PackageFile): ModifyOutcome {
  const body = JSON.stringify(file.pkg, null, file.indent).replace(
    /\n/g,
    file.eol,
  );
  const next = body + file.trailing;
  if (next === file.text) return { status: "success", changed: false };
  fs.writeFileSync(file.filePath, next, "utf8");
  return { status: "success", changed: true };
}

/**
 * Add `key` to `pkg` right after the first of `after` it has, else at the end.
 * JSON object key order is insertion order, so this rebuilds the object.
 */
function insertKey(
  pkg: JsonObject,
  key: string,
  value: Json,
  after: string[],
): JsonObject {
  const anchor = after.find((name) => name in pkg);
  if (!anchor) return { ...pkg, [key]: value };
  const next: JsonObject = {};
  for (const [name, existing] of Object.entries(pkg)) {
    next[name] = existing;
    if (name === anchor) next[key] = value;
  }
  return next;
}

function finish(
  file: PackageFile,
  conflicts: string[],
  field: string,
): PackageJsonEditResult {
  const outcome = writePackage(file);
  if (conflicts.length === 0) return { filePath: file.filePath, outcome };
  return {
    filePath: file.filePath,
    outcome: {
      status: "failed",
      message: [
        `package.json \`${field}\` already has a different value for:`,
        ...conflicts.map((line) => `  ${line}`),
        "Change these by hand if vela's value is the one you want.",
      ].join("\n"),
    },
  };
}

/**
 * Add the subpath `imports` (`{ "#lib/*": "./src/lib/*" }`) that are missing.
 * Creates `imports` after `type` when the project has none.
 */
export function ensurePackageImports(
  root: string,
  entries: Record<string, string>,
): PackageJsonEditResult {
  const file = readPackage(root);
  if (!("pkg" in file)) return file;

  const current = file.pkg.imports;
  if (current !== undefined && !isObject(current)) {
    return {
      filePath: file.filePath,
      outcome: {
        status: "failed",
        message: [
          "package.json `imports` is not an object. Add these entries to it by hand:",
          ...Object.entries(entries).map(
            ([key, value]) =>
              `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`,
          ),
        ].join("\n"),
      },
    };
  }

  const imports: JsonObject = { ...(current ?? {}) };
  const conflicts: string[] = [];
  for (const [key, value] of Object.entries(entries)) {
    if (!(key in imports)) {
      imports[key] = value;
    } else if (imports[key] !== value) {
      conflicts.push(
        `${JSON.stringify(key)}: ${JSON.stringify(imports[key])} (vela uses ${JSON.stringify(value)})`,
      );
    }
  }
  file.pkg =
    current === undefined
      ? Object.keys(imports).length > 0
        ? insertKey(file.pkg, "imports", imports, ["type", "version", "name"])
        : file.pkg
      : { ...file.pkg, imports };
  return finish(file, conflicts, "imports");
}

/**
 * Remove subpath `imports` keys. With `expected`, a key is removed only while
 * it still maps to the value vela wrote, so one the developer repointed stays.
 * An `imports` left empty is removed too.
 */
export function removePackageImports(
  root: string,
  keys: string[],
  expected?: Record<string, string>,
): PackageJsonEditResult {
  const file = readPackage(root);
  if (!("pkg" in file)) {
    // Nothing to revert in a project without a package.json.
    return file.outcome.status === "not-found"
      ? {
          filePath: file.filePath,
          outcome: { status: "success", changed: false },
        }
      : file;
  }
  const current = file.pkg.imports;
  if (!isObject(current)) {
    return {
      filePath: file.filePath,
      outcome: { status: "success", changed: false },
    };
  }
  const imports: JsonObject = { ...current };
  for (const key of keys) {
    if (!(key in imports)) continue;
    if (expected && key in expected && imports[key] !== expected[key]) continue;
    delete imports[key];
  }
  if (Object.keys(imports).length === 0) {
    const { imports: _, ...rest } = file.pkg;
    file.pkg = rest;
  } else {
    file.pkg = { ...file.pkg, imports };
  }
  return { filePath: file.filePath, outcome: writePackage(file) };
}

/**
 * Deep-merge `overrides` into package.json's `overrides`, created at the end
 * when missing. A version already there that differs is left as it is and
 * reported. A package overridden with a bare version that now needs nested
 * overrides keeps that version as npm's `"."`.
 */
export function ensurePackageOverrides(
  root: string,
  overrides: Record<string, OverrideValue>,
): PackageJsonEditResult {
  const file = readPackage(root);
  if (!("pkg" in file)) return file;

  const current = file.pkg.overrides;
  if (current !== undefined && !isObject(current)) {
    return {
      filePath: file.filePath,
      outcome: {
        status: "failed",
        message: `package.json \`overrides\` is not an object. Add this to it by hand:\n${JSON.stringify(overrides, null, 2)}`,
      },
    };
  }
  const conflicts: string[] = [];
  const merged = mergeOverrides(current ?? {}, overrides, [], conflicts);
  file.pkg = { ...file.pkg, overrides: merged };
  return finish(file, conflicts, "overrides");
}

function mergeOverrides(
  target: JsonObject,
  source: Record<string, OverrideValue>,
  trail: string[],
  conflicts: string[],
): JsonObject {
  const out: JsonObject = { ...target };
  for (const [key, wanted] of Object.entries(source)) {
    const have = out[key];
    const where = [...trail, key].join(" > ");
    if (have === undefined) {
      out[key] = wanted as Json;
    } else if (typeof wanted === "string") {
      if (have === wanted) continue;
      if (isObject(have) && have["."] === wanted) continue;
      conflicts.push(
        `${where}: ${JSON.stringify(have)} (vela uses ${JSON.stringify(wanted)})`,
      );
    } else if (isObject(have)) {
      out[key] = mergeOverrides(have, wanted, [...trail, key], conflicts);
    } else if (typeof have === "string") {
      out[key] = mergeOverrides(
        { ".": have },
        wanted,
        [...trail, key],
        conflicts,
      );
    } else {
      conflicts.push(
        `${where}: ${JSON.stringify(have)} (vela uses ${JSON.stringify(wanted)})`,
      );
    }
  }
  return out;
}
