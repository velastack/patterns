import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeResult } from "./write-result";
import type { Options, Result } from "../core/types";

function options(root: string): Options {
  return {
    argv: [],
    env: "runtime",
    root,
    features: {
      auth: true,
      api: false,
      apiKeys: false,
      backend: true,
      i18n: false,
      teams: false,
      payments: false,
      blog: false,
      contentNegotiation: false,
      cms: false,
    },
    input: {},
  };
}

function deletes(...paths: string[]): Result {
  return {
    creates: [],
    modifies: [],
    deletes: paths.map((p) => ({
      path: p,
      language: "ts",
      content: "",
      status: "success",
    })),
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  };
}

describe("writeResult deletes", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), "write-result-deletes-"));
    writeFileSync(path.join(root, "package.json"), "{}");
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("removes directories left empty by a delete", async () => {
    const dir = path.join(root, "src/routes/(app)/dashboard");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "+page.svelte"), "");
    writeFileSync(path.join(root, "src/routes/+layout.svelte"), "");

    await writeResult(
      deletes("src/routes/(app)/dashboard/+page.svelte"),
      options(root),
    );

    expect(existsSync(path.join(root, "src/routes/(app)"))).toBe(false);
    expect(existsSync(path.join(root, "src/routes/+layout.svelte"))).toBe(true);
  });

  it("keeps directories that still hold other files", async () => {
    const dir = path.join(root, "src/routes/(app)");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "+layout.svelte"), "");
    writeFileSync(path.join(dir, "+page.svelte"), "");

    await writeResult(deletes("src/routes/(app)/+page.svelte"), options(root));

    expect(existsSync(path.join(dir, "+layout.svelte"))).toBe(true);
  });

  it("never removes the project root", async () => {
    writeFileSync(path.join(root, "only.ts"), "");
    rmSync(path.join(root, "package.json"));

    await writeResult(deletes("only.ts"), options(root));

    expect(existsSync(root)).toBe(true);
  });
});
