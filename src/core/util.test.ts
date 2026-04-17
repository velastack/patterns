import { describe, expect, it } from "vitest";
import type { Result } from "./types";
import { appRelativePath, languageFromPath, mergeResults } from "./util";

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
    };
    expect(mergeResults([a, b])).toEqual({
      creates: a.creates,
      modifies: b.modifies,
      deletes: b.deletes,
      components: ["A", "B"],
      packages: ["pkg-a"],
      collections: [...a.collections, ...b.collections],
    });
  });
});
