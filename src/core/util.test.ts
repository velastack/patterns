import { describe, expect, it } from "vitest";
import type { Result } from "./types";
import {
  appRelativePath,
  composeCreates,
  filesFromGlob,
  languageFromPath,
  mergeResults,
} from "./util";

describe("appRelativePath", () => {
  it("strips the prefix when globKey starts with it", () => {
    expect(appRelativePath("src/routes/+page.svelte", "src/")).toBe(
      "routes/+page.svelte",
    );
  });

  it("returns the key unchanged when it does not start with prefix (no leading ./)", () => {
    expect(appRelativePath("routes/+page.svelte", "app/")).toBe(
      "routes/+page.svelte",
    );
  });

  it("strips a leading ./ when prefix does not match", () => {
    expect(appRelativePath("./routes/+page.svelte", "app/")).toBe(
      "routes/+page.svelte",
    );
  });
});

describe("languageFromPath", () => {
  it.each([
    ["file.svelte", "svelte"],
    ["Component.tsx", "ts"],
    ["util.ts", "ts"],
    ["App.jsx", "js"],
    ["index.js", "js"],
    ["styles.css", "text"],
    ["README", "text"],
  ])("maps %s to %s", (path, expected) => {
    expect(languageFromPath(path)).toBe(expected);
  });
});

describe("mergeResults", () => {
  it("returns empty buckets for an empty list", () => {
    expect(mergeResults([])).toEqual({
      creates: [],
      modifies: [],
      deletes: [],
      components: [],
      packages: [],
      collections: [],
      collectionPatches: [],
      collectionDrops: [],
    });
  });

  it("concatenates all fields from multiple results in order", () => {
    const a: Result = {
      creates: [
        { path: "a.ts", language: "ts", content: "", status: "success" },
      ],
      modifies: [],
      deletes: [],
      components: ["A"],
      packages: ["pkg-a"],
      collections: [{ name: "products", type: "base", fields: [] }],
      collectionPatches: [],
      collectionDrops: [],
    };
    const b: Result = {
      creates: [],
      modifies: [
        { path: "b.ts", language: "ts", content: "", status: "success" },
      ],
      deletes: [
        { path: "old.ts", language: "ts", content: "", status: "success" },
      ],
      components: ["B"],
      packages: [],
      collections: [{ name: "invoices", type: "base", fields: [] }],
      collectionPatches: [],
      collectionDrops: [],
    };
    expect(mergeResults([a, b])).toEqual({
      creates: a.creates,
      modifies: b.modifies,
      deletes: b.deletes,
      components: ["A", "B"],
      packages: ["pkg-a"],
      collections: [...a.collections, ...b.collections],
      collectionPatches: [],
      collectionDrops: [],
    });
  });
});

describe("filesFromGlob", () => {
  it("strips the prefix and produces File records keyed by relative path", () => {
    const files = filesFromGlob(
      {
        "./creates/src/foo.ts": "foo",
        "./creates/src/bar.svelte": "<bar />",
      },
      "./creates/",
    );
    expect(files).toEqual({
      "src/foo.ts": {
        path: "src/foo.ts",
        language: "ts",
        content: "foo",
        status: "success",
      },
      "src/bar.svelte": {
        path: "src/bar.svelte",
        language: "svelte",
        content: "<bar />",
        status: "success",
      },
    });
  });
});

describe("composeCreates", () => {
  const createsRaw = {
    "./creates/src/a.ts": "base-a",
    "./creates/src/b.ts": "base-b",
  };
  const variantsRaw = {
    "./variants/split/src/a.ts": "split-a",
    "./variants/split/src/c.ts": "split-c",
    "./variants/other/src/a.ts": "other-a",
  };

  it("returns sorted creates files when no variant is selected", () => {
    expect(composeCreates(createsRaw, "./creates/")).toEqual([
      {
        path: "src/a.ts",
        language: "ts",
        content: "base-a",
        status: "success",
      },
      {
        path: "src/b.ts",
        language: "ts",
        content: "base-b",
        status: "success",
      },
    ]);
  });

  it("ignores variantsRaw when variant is undefined or empty", () => {
    const without = composeCreates(createsRaw, "./creates/", variantsRaw);
    const empty = composeCreates(createsRaw, "./creates/", variantsRaw, "");
    expect(without.map((f) => f.content)).toEqual(["base-a", "base-b"]);
    expect(empty.map((f) => f.content)).toEqual(["base-a", "base-b"]);
  });

  it("overrides matching paths and adds variant-only files", () => {
    const result = composeCreates(
      createsRaw,
      "./creates/",
      variantsRaw,
      "split",
    );
    expect(result).toEqual([
      {
        path: "src/a.ts",
        language: "ts",
        content: "split-a",
        status: "success",
      },
      {
        path: "src/b.ts",
        language: "ts",
        content: "base-b",
        status: "success",
      },
      {
        path: "src/c.ts",
        language: "ts",
        content: "split-c",
        status: "success",
      },
    ]);
  });

  it("falls back to base when variant name has no matching files", () => {
    const result = composeCreates(
      createsRaw,
      "./creates/",
      variantsRaw,
      "missing",
    );
    expect(result.map((f) => f.content)).toEqual(["base-a", "base-b"]);
  });
});
