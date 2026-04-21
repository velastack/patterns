import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

import { unmodifyHooksServerNegotiate } from "./hooks.server";
import { unmodifyHooksNegotiate } from "./hooks";
import { unmodifyRootLayoutNegotiate } from "./root-layout.svelte";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesPath = path.join(__dirname, "fixtures");
const tempDir = path.join(__dirname, "temp");

describe("disable content-negotiation modifiers", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("unwraps a two-arg sequence back to the original handle", async () => {
    const filePath = path.join(tempDir, "hooks.server.ts");
    unmodifyHooksServerNegotiate(filePath);

    const modified = fs.readFileSync(filePath, "utf8");
    const expected = fs.readFileSync(
      path.join(fixturesPath, "expect", "hooks.server.ts"),
      "utf8",
    );
    await expect(modified).toMatchFormatted(expected, "hooks.server.ts");
  });

  it("removes handleNegotiate from a multi-arg sequence", async () => {
    const filePath = path.join(tempDir, "hooks.server.many.ts");
    unmodifyHooksServerNegotiate(filePath);

    const modified = fs.readFileSync(filePath, "utf8");
    const expected = fs.readFileSync(
      path.join(fixturesPath, "expect", "hooks.server.many.ts"),
      "utf8",
    );
    await expect(modified).toMatchFormatted(expected, "hooks.server.ts");
  });

  it("is idempotent for hooks.server.ts", () => {
    const filePath = path.join(tempDir, "hooks.server.ts");

    unmodifyHooksServerNegotiate(filePath);
    const first = fs.readFileSync(filePath, "utf8");

    unmodifyHooksServerNegotiate(filePath);
    const second = fs.readFileSync(filePath, "utf8");

    expect(second).toBe(first);
  });

  it("deletes hooks.ts when it only contained the negotiate reroute", () => {
    const filePath = path.join(tempDir, "hooks.negotiate-only.ts");
    expect(fs.existsSync(filePath)).toBe(true);

    unmodifyHooksNegotiate(filePath);

    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("unwraps the i18n-compose reroute back to the i18n-only form", async () => {
    const filePath = path.join(tempDir, "hooks.i18n-compose.ts");
    unmodifyHooksNegotiate(filePath);

    const modified = fs.readFileSync(filePath, "utf8");
    const expected = fs.readFileSync(
      path.join(fixturesPath, "expect", "hooks.i18n-compose.ts"),
      "utf8",
    );
    await expect(modified).toMatchFormatted(expected, "hooks.ts");
  });

  it("is idempotent for hooks.ts (i18n compose)", () => {
    const filePath = path.join(tempDir, "hooks.i18n-compose.ts");

    unmodifyHooksNegotiate(filePath);
    const first = fs.readFileSync(filePath, "utf8");

    unmodifyHooksNegotiate(filePath);
    const second = fs.readFileSync(filePath, "utf8");

    expect(second).toBe(first);
  });

  it("removes <Negotiate /> and import from root-layout.svelte", async () => {
    const filePath = path.join(tempDir, "root-layout.svelte");
    unmodifyRootLayoutNegotiate(filePath);

    const modified = fs.readFileSync(filePath, "utf8");
    const expected = fs.readFileSync(
      path.join(fixturesPath, "expect", "root-layout.svelte"),
      "utf8",
    );
    await expect(modified).toMatchFormatted(expected, "root-layout.svelte");
  });

  it("is idempotent for root-layout.svelte", () => {
    const filePath = path.join(tempDir, "root-layout.svelte");

    unmodifyRootLayoutNegotiate(filePath);
    const first = fs.readFileSync(filePath, "utf8");

    unmodifyRootLayoutNegotiate(filePath);
    const second = fs.readFileSync(filePath, "utf8");

    expect(second).toBe(first);
  });
});
