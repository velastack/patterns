import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Patterns emit SvelteKit 3 code only. This scans the source tree (template
 * assets, fixtures, generators and their tests) for Kit 2 forms that would
 * reach a generated project.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SELF = "src/kit3-guard.test.ts";

const TEXT = /\.(ts|js|svelte|svx|md|json|html|css)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "temp") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (TEXT.test(entry.name)) out.push(full);
  }
  return out;
}

const files = [
  ...walk(path.join(ROOT, "src")),
  ...walk(path.join(ROOT, "integration")),
  path.join(ROOT, "README.md"),
]
  .map((file) => path.relative(ROOT, file).split(path.sep).join("/"))
  .filter((file) => file !== SELF);

/** Kit 2-shaped inputs that prove the disable modifiers still handle them. */
const LEGACY_FIXTURE = /\/fixtures\/(.+\/)?legacy-[^/]*$/;

/**
 * Files that handle `$lib` on purpose: the specifier helper (it matches the
 * legacy alias) and components.json `aliases` values.
 * TODO(P1): `resolveUiDir` accepts `#lib`; drop the registry/ui/table-core/
 * write-result entries once their components.json cases move to `#lib`.
 */
const LIB_ALLOWED = new Set([
  "src/runtime/lib-specifier.ts",
  "src/runtime/lib-specifier.test.ts",
  "src/runtime/registry.ts",
  "src/runtime/registry.test.ts",
  "src/runtime/ui.test.ts",
  "src/runtime/table-core.test.ts",
  "src/runtime/write-result.test.ts",
]);

const HOOK_TYPES = [
  "Handle",
  "ServerInit",
  "Reroute",
  "HandleServerError",
  "HandleFetch",
  "ClientInit",
  "HandleClientError",
  "HandleValidationError",
  "Transport",
  "Transporter",
  "ResolveOptions",
];

const KEPT_EXTENSION = /\.(js|svelte|svg|svx|css|json)$/;

function scan(
  test: (source: string, file: string) => string[],
  allowed: (file: string) => boolean = () => false,
): string[] {
  const hits: string[] = [];
  for (const file of files) {
    if (LEGACY_FIXTURE.test(file) || allowed(file)) continue;
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const hit of test(source, file)) hits.push(`${file}: ${hit}`);
  }
  return hits;
}

function lineHits(pattern: RegExp) {
  return (source: string) =>
    source
      .split("\n")
      .map((line, i) => [line, i + 1] as const)
      .filter(([line]) => pattern.test(line))
      .map(([line, n]) => `${n}: ${line.trim()}`);
}

describe("SvelteKit 3 guard", () => {
  it("has files to scan", () => {
    expect(files.length).toBeGreaterThan(500);
  });

  it("uses #lib, not $lib", () => {
    expect(scan(lineHits(/\$lib\b/), (f) => LIB_ALLOWED.has(f))).toEqual([]);
  });

  it("imports $app/env, not $app/environment", () => {
    expect(scan(lineHits(/\$app\/environment\b/))).toEqual([]);
  });

  it("writes #lib specifiers with the file's extension", () => {
    expect(
      scan(
        (source) =>
          [...source.matchAll(/(['"])(#lib\/[^'"\n]*)\1/g)]
            .map((m) => m[2])
            // A trailing slash is a prefix (`not.toContain("#lib/components/ui/")`).
            .filter(
              (spec) => !spec.endsWith("/") && !KEPT_EXTENSION.test(spec),
            ),
        (f) => f.startsWith("src/runtime/lib-specifier"),
      ),
    ).toEqual([]);
  });

  it("imports hook types from @sveltejs/kit/hooks", () => {
    const names = HOOK_TYPES.join("|");
    const named = new RegExp(
      String.raw`import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]@sveltejs/kit['"]`,
      "g",
    );
    const inline = new RegExp(
      String.raw`import\(\s*['"]@sveltejs/kit['"]\s*\)\.(${names})\b`,
      "g",
    );
    const hook = new RegExp(String.raw`^(?:type\s+)?(${names})\b`);
    expect(
      scan((source) => [
        ...[...source.matchAll(named)]
          .filter((m) => m[1].split(",").some((spec) => hook.test(spec.trim())))
          .map((m) => m[0].replace(/\s+/g, " ")),
        ...[...source.matchAll(inline)].map((m) => m[0]),
      ]),
    ).toEqual([]);
  });

  // Enabled by the groups that make these changes.
  it.todo("reads env vars from $app/env/{private,public}, not $env/*");
  it.todo("has no svelte.config.* in preview-modifies (P1: vite.config.ts)");
});
