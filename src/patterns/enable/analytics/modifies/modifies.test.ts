import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

import { modifyLayoutSvelte } from "./layout.svelte";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesPath = path.join(__dirname, "fixtures");
const tempDir = path.join(__dirname, "temp");

const LAYOUT_SVELTE = path.join("src", "routes", "+layout.svelte");
const STATIC_LAYOUT_SVELTE = path.join("static", LAYOUT_SVELTE);
const IMPORT =
  "import Analytics from '$lib/components/analytics/analytics.svelte';";

function read(rel: string): string {
  return fs.readFileSync(path.join(tempDir, rel), "utf8");
}

function expected(rel: string): string {
  return fs.readFileSync(path.join(fixturesPath, "expect", rel), "utf8");
}

describe("enable analytics modifiers", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("mounts <Analytics /> in the minimal +layout.svelte", async () => {
    const filePath = path.join(tempDir, LAYOUT_SVELTE);
    const outcome = modifyLayoutSvelte(filePath);

    expect(outcome).toEqual({ status: "success", changed: true });
    await expect(read(LAYOUT_SVELTE)).toMatchFormatted(
      expected(LAYOUT_SVELTE),
      "+layout.svelte",
    );
  });

  it("mounts <Analytics /> ahead of the page content in the static +layout.svelte", async () => {
    const filePath = path.join(tempDir, STATIC_LAYOUT_SVELTE);
    const outcome = modifyLayoutSvelte(filePath);

    expect(outcome).toEqual({ status: "success", changed: true });
    const modified = read(STATIC_LAYOUT_SVELTE);
    expect(modified).toContain(IMPORT);
    const mount = modified.indexOf("<Analytics />");
    const render = modified.indexOf("{@render children?.()}");
    expect(mount).toBeGreaterThan(-1);
    expect(render).toBeGreaterThan(-1);
    expect(mount).toBeLessThan(render);
    await expect(modified).toMatchFormatted(
      expected(STATIC_LAYOUT_SVELTE),
      "+layout.svelte",
    );
  });

  it("is idempotent", () => {
    const filePath = path.join(tempDir, LAYOUT_SVELTE);

    modifyLayoutSvelte(filePath);
    const first = read(LAYOUT_SVELTE);

    const outcome = modifyLayoutSvelte(filePath);
    const second = read(LAYOUT_SVELTE);

    expect(outcome).toEqual({ status: "success", changed: false });
    expect(second).toBe(first);
    expect(second.split(IMPORT).length).toBe(2);
  });

  it("reports failure for a layout without a script block", () => {
    const filePath = path.join(tempDir, "src", "routes", "bare.svelte");
    fs.writeFileSync(filePath, "<slot />\n");
    const original = fs.readFileSync(filePath, "utf8");

    const outcome = modifyLayoutSvelte(filePath);
    const modified = fs.readFileSync(filePath, "utf8");

    expect(outcome.status).toBe("failed");
    if (outcome.status === "failed") {
      expect(outcome.message).toContain("<Analytics />");
      expect(outcome.message).toContain(IMPORT);
    }
    expect(modified).toBe(original);
  });

  it("reports not-found when +layout.svelte is missing", () => {
    const outcome = modifyLayoutSvelte(
      path.join(tempDir, "src", "routes", "missing.svelte"),
    );
    expect(outcome.status).toBe("not-found");
    if (outcome.status === "not-found") {
      expect(outcome.message).toContain("<Analytics />");
    }
  });
});
