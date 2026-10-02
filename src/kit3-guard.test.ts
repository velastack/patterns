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
 * Files that handle `$lib` on purpose, each with why. Kit 2-shaped fixtures
 * are already skipped by {@link LEGACY_FIXTURE}.
 */
const LIB_ALLOWED = new Map([
  [
    "src/runtime/lib-specifier.ts",
    "matches the legacy alias in imports and components.json `aliases`",
  ],
  ["src/runtime/lib-specifier.test.ts", "tests that legacy matching"],
]);

/**
 * Files that handle `$env/*` on purpose, each with why. Kit 2-shaped
 * fixtures are already skipped by {@link LEGACY_FIXTURE}.
 */
const ENV_ALLOWED = new Map([
  [
    "src/patterns/disable/backend/modifies/hooks.server.ts",
    "prunes the `env` import a hooks.server.ts written before SvelteKit 3 still has",
  ],
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

/** Right before a components.json `aliases` value: `ui: `, `"utils": `. */
const ALIAS_KEY = /["']?\b(ui|utils|components|hooks|lib)["']?\s*:\s*$/;

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
            // components.json `aliases` name directories, not modules.
            .filter(
              (m) =>
                !ALIAS_KEY.test(
                  source.slice(Math.max(0, m.index - 40), m.index),
                ),
            )
            .map((m) => m[2])
            // A trailing slash is a prefix (`not.toContain("#lib/components/ui/")`),
            // and `#lib/*` is the package.json `imports` pattern.
            .filter(
              (spec) =>
                !spec.endsWith("/") &&
                !spec.endsWith("/*") &&
                !KEPT_EXTENSION.test(spec),
            ),
        // Its tables list extensionless specifiers to show what they resolve to.
        (f) => LIB_ALLOWED.has(f),
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

  it("reads env vars from $app/env/{private,public}, not $env/*", () => {
    expect(scan(lineHits(/\$env\//), (f) => ENV_ALLOWED.has(f))).toEqual([]);
  });

  it("has no svelte.config.* in preview-modifies", () => {
    // Every file, not just the text extensions `files` keeps.
    const all = (dir: string): string[] =>
      fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap((entry) =>
          entry.isDirectory()
            ? all(path.join(dir, entry.name))
            : [path.join(dir, entry.name)],
        );
    const hits = all(path.join(ROOT, "src"))
      .map((file) => path.relative(ROOT, file).split(path.sep).join("/"))
      .filter((file) =>
        /\/preview-modifies\/(.+\/)?svelte\.config\.[^/]*$/.test(file),
      );
    expect(hits).toEqual([]);
  });
});
