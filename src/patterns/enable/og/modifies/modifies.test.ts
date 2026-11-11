import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

import { modifyLayoutSvelte } from "./layout.svelte";
import { unmodifyLayoutSvelte } from "../../../disable/og/modifies/layout.svelte";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesPath = path.join(__dirname, "fixtures");
const tempDir = path.join(__dirname, "temp");

const LAYOUTS = [
  ["minimal", path.join("src", "routes", "+layout.svelte")],
  ["static", path.join("static", "src", "routes", "+layout.svelte")],
] as const;

const read = (rel: string) => fs.readFileSync(path.join(tempDir, rel), "utf8");
const fixture = (kind: "original" | "expect", rel: string) =>
  fs.readFileSync(path.join(fixturesPath, kind, rel), "utf8");

describe("og layout modifiers", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it.each(LAYOUTS)("wraps metaTags in the %s layout", async (_name, rel) => {
    const outcome = modifyLayoutSvelte(path.join(tempDir, rel));
    expect(outcome).toEqual({ status: "success", changed: true });
    await expect(read(rel)).toMatchFormatted(
      fixture("expect", rel),
      "+layout.svelte",
    );
  });

  it.each(LAYOUTS)("is idempotent in the %s layout", (_name, rel) => {
    const filePath = path.join(tempDir, rel);
    modifyLayoutSvelte(filePath);
    const once = read(rel);
    expect(modifyLayoutSvelte(filePath)).toEqual({
      status: "success",
      changed: false,
    });
    expect(read(rel)).toBe(once);
  });

  it.each(LAYOUTS)("disable restores the %s layout", async (_name, rel) => {
    const filePath = path.join(tempDir, rel);
    modifyLayoutSvelte(filePath);
    expect(unmodifyLayoutSvelte(filePath)).toEqual({
      status: "success",
      changed: true,
    });
    await expect(read(rel)).toMatchFormatted(
      fixture("original", rel),
      "+layout.svelte",
    );
  });

  it("hands back the snippet when the layout builds metaTags another way", () => {
    const filePath = path.join(tempDir, "custom.svelte");
    const source = '<script lang="ts">\n\tlet metaTags = {};\n</script>\n';
    fs.writeFileSync(filePath, source);
    const outcome = modifyLayoutSvelte(filePath);
    expect(outcome.status).toBe("failed");
    expect(fs.readFileSync(filePath, "utf8")).toBe(source);
  });

  it("reports a missing layout", () => {
    const outcome = modifyLayoutSvelte(path.join(tempDir, "nope.svelte"));
    expect(outcome.status).toBe("not-found");
  });

  it("leaves a layout without withCard alone on disable", () => {
    const [, rel] = LAYOUTS[0];
    expect(unmodifyLayoutSvelte(path.join(tempDir, rel))).toEqual({
      status: "success",
      changed: false,
    });
  });
});
