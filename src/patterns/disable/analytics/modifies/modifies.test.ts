import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

import { modifyLayoutSvelte } from "../../../enable/analytics/modifies/layout.svelte";
import { unmodifyLayoutSvelte } from "./layout.svelte";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// enable-analytics' own fixtures: a round trip must land back on `original`.
const fixturesPath = path.join(
  __dirname,
  "../../../enable/analytics/modifies/fixtures",
);
const tempDir = path.join(__dirname, "temp");

const LAYOUT_SVELTE = path.join("src", "routes", "+layout.svelte");
const STATIC_LAYOUT_SVELTE = path.join("static", LAYOUT_SVELTE);

function read(rel: string): string {
  return fs.readFileSync(path.join(tempDir, rel), "utf8");
}

function original(rel: string): string {
  return fs.readFileSync(path.join(fixturesPath, "original", rel), "utf8");
}

describe("disable analytics modifiers", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it.each([LAYOUT_SVELTE, STATIC_LAYOUT_SVELTE])(
    "restores %s byte for byte after enable-analytics",
    (rel) => {
      const filePath = path.join(tempDir, rel);
      expect(modifyLayoutSvelte(filePath)).toEqual({
        status: "success",
        changed: true,
      });

      expect(unmodifyLayoutSvelte(filePath)).toEqual({
        status: "success",
        changed: true,
      });
      expect(read(rel)).toBe(original(rel));
    },
  );

  it("leaves a layout without <Analytics /> alone", () => {
    const filePath = path.join(tempDir, LAYOUT_SVELTE);
    expect(unmodifyLayoutSvelte(filePath)).toEqual({
      status: "success",
      changed: false,
    });
    expect(read(LAYOUT_SVELTE)).toBe(original(LAYOUT_SVELTE));
  });

  it("is a no-op without a root layout", () => {
    expect(
      unmodifyLayoutSvelte(path.join(tempDir, "src/routes/missing.svelte")),
    ).toEqual({ status: "success", changed: false });
  });
});
