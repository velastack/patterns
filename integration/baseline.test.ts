import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  copyGeneratedModules,
  hardLinkTree,
  restoreCache,
  saveCache,
} from "./baseline";

describe("hardLinkTree", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), "hard-link-tree-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("hard-links files and recreates symlinks as symlinks", () => {
    const from = path.join(root, "node_modules");
    mkdirSync(path.join(from, "pkg", "dist"), { recursive: true });
    mkdirSync(path.join(from, ".bin"));
    writeFileSync(path.join(from, "pkg", "dist", "index.mjs"), "export {};\n");
    symlinkSync("../pkg/dist/index.mjs", path.join(from, ".bin", "pkg"));

    const to = path.join(root, "clone");
    hardLinkTree(from, to);

    const file = path.join(to, "pkg", "dist", "index.mjs");
    expect(statSync(file).ino).toBe(
      statSync(path.join(from, "pkg", "dist", "index.mjs")).ino,
    );

    const bin = path.join(to, ".bin", "pkg");
    expect(lstatSync(bin).isSymbolicLink()).toBe(true);
    expect(readlinkSync(bin)).toBe("../pkg/dist/index.mjs");
  });
});

describe("node_modules/$app", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), "generated-modules-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** A project whose `svelte-kit sync` has written `$app`. */
  function project(name: string, routes: string): string {
    const dir = path.join(root, name);
    mkdirSync(path.join(dir, "node_modules", "pkg"), { recursive: true });
    mkdirSync(path.join(dir, "node_modules", "$app", "types"), {
      recursive: true,
    });
    writeFileSync(path.join(dir, "node_modules", "pkg", "index.js"), "");
    writeFileSync(
      path.join(dir, "node_modules", "$app", "types", "index.d.ts"),
      routes,
    );
    return dir;
  }

  it("is left out of the cache, and out of a restore from an old cache", () => {
    const source = project("source", "'/a'");
    const cache = path.join(root, "cache");
    saveCache(cache, source);
    expect(
      existsSync(path.join(cache, "node_modules", "pkg", "index.js")),
    ).toBe(true);
    expect(existsSync(path.join(cache, "node_modules", "$app"))).toBe(false);

    // A cache saved before the fix: `$app` linked in.
    const old = path.join(root, "old-cache");
    hardLinkTree(
      path.join(source, "node_modules"),
      path.join(old, "node_modules"),
    );
    const target = path.join(root, "target");
    restoreCache(old, target);
    expect(existsSync(path.join(target, "node_modules", "pkg"))).toBe(true);
    expect(existsSync(path.join(target, "node_modules", "$app"))).toBe(false);
  });

  it("is a real copy in a cloned project", () => {
    const baseline = project("baseline", "'/a'");
    const clone = path.join(root, "clone");
    hardLinkTree(
      path.join(baseline, "node_modules"),
      path.join(clone, "node_modules"),
    );
    copyGeneratedModules(baseline, clone);

    const cloned = path.join(
      clone,
      "node_modules",
      "$app",
      "types",
      "index.d.ts",
    );
    const original = path.join(
      baseline,
      "node_modules",
      "$app",
      "types",
      "index.d.ts",
    );
    expect(statSync(cloned).ino).not.toBe(statSync(original).ino);
    // An in-place write, as `svelte-kit sync` does it, stays in the clone.
    writeFileSync(cloned, "'/b'");
    expect(readFileSync(original, "utf8")).toBe("'/a'");
  });
});
