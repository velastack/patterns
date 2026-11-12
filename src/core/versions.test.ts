import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import semver from "semver";
import { describe, expect, it } from "vitest";
import { VERSION_HOLDS, VERSION_TRACKS, VERSIONS, spec } from "./versions";

const SRC = path.resolve(__dirname, "..");

/** Source files of this package: no tests, and nothing destined for a generated project. */
function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        /^(creates|modifies|originals|fixtures|preview-modifies|components|src)$/.test(
          entry.name,
        ) ||
        entry.name.startsWith("creates-")
      ) {
        continue;
      }
      found.push(...sourceFiles(full));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      found.push(full);
    }
  }
  return found;
}

describe("versions.json", () => {
  it("lists a valid range for every package, in order", () => {
    const names = Object.keys(VERSIONS);
    expect(names).toEqual([...names].sort());
    for (const name of names) {
      expect(semver.validRange(VERSIONS[name]), name).not.toBeNull();
    }
  });

  it("holds and tracks only packages it lists, each with a reason", () => {
    for (const [name, hold] of Object.entries(VERSION_HOLDS)) {
      expect(VERSIONS[name], name).toBeDefined();
      expect(hold.reason.length, name).toBeGreaterThan(20);
      expect(hold.since, name).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    for (const [name, track] of Object.entries(VERSION_TRACKS)) {
      expect(VERSIONS[name], name).toBeDefined();
      expect(track.source, name).toBe("sv-create");
    }
  });

  it("gives formsnap a superforms it peers with", () => {
    // formsnap 2.1 is the first release whose superforms peer admits 3.x.
    expect(semver.gte(semver.minVersion(VERSIONS.formsnap!)!, "2.1.0")).toBe(
      true,
    );
    expect(semver.minVersion(VERSIONS["sveltekit-superforms"]!)!.major).toBe(3);
  });
});

describe("spec", () => {
  it("joins a listed package with its range", () => {
    expect(spec("zod")).toBe(`zod@${VERSIONS.zod}`);
    expect(spec("@velastack/kit")).toBe(
      `@velastack/kit@${VERSIONS["@velastack/kit"]}`,
    );
  });

  it("refuses a package that is not listed", () => {
    expect(() => spec("left-pad")).toThrow(/versions\.json/);
  });
});

describe("install specs", () => {
  // A range written inline is a second copy of one in versions.json, and the
  // weekly bump would raise one and not the other.
  it("are never written inline with a version", () => {
    const inline: string[] = [];
    const pattern =
      /["'`](@?[a-z0-9][\w.-]*(?:\/[\w.-]+)?)@[\^~]?\d+\.\d+\.\d+[^"'`]*["'`]/g;
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, "utf8")
        // Comments may show a spec as an example.
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      for (const match of text.matchAll(pattern)) {
        inline.push(`${path.relative(SRC, file)}: ${match[0]}`);
      }
    }
    expect(inline).toEqual([]);
  });
});
