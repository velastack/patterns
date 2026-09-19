import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Options } from "../core/types";
import { ensureSiteFile, siteModule, sitePath } from "./site";

let root: string;

function options(backend = false): Options {
  return {
    argv: [],
    env: "runtime",
    root,
    features: {
      auth: false,
      api: false,
      apiKeys: false,
      backend,
      i18n: false,
      teams: false,
      payments: false,
      blog: false,
      contentNegotiation: false,
      cms: false,
    },
    input: { silent: true },
  };
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "site-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("siteModule", () => {
  it("fills name and url as single-quoted strings", () => {
    const source = siteModule("Tom's Cafe", "https://example.com");
    expect(source).toContain("name: 'Tom\\'s Cafe',");
    expect(source).toContain("url: 'https://example.com'");
    expect(source).toContain("export const site = {");
  });
});

describe("ensureSiteFile", () => {
  it("never replaces an existing site.ts", async () => {
    fs.mkdirSync(path.dirname(sitePath(root)), { recursive: true });
    fs.writeFileSync(sitePath(root), "export const site = { name: 'Mine' };\n");
    expect(await ensureSiteFile(options())).toBeNull();
  });

  it("names a new one after the package", async () => {
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ name: "my-app" }),
    );
    const file = await ensureSiteFile(options());
    expect(file?.path).toBe(sitePath(root));
    expect(file?.content).toContain("name: 'my-app',");
    expect(file?.content).toContain("url: 'http://localhost:5173'");
  });

  it("falls back to the package when PocketBase can't be asked", async () => {
    // A backend project with no data/ directory: withPocketbase throws.
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ name: "my-app" }),
    );
    const file = await ensureSiteFile(options(true));
    expect(file?.content).toContain("name: 'my-app',");
  });
});
