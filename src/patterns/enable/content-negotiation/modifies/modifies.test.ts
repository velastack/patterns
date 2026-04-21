import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

import { modifyHooksServerNegotiate } from "./hooks.server";
import { modifyHooksNegotiate } from "./hooks";
import { modifyRootLayoutNegotiate } from "./root-layout.svelte";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesPath = path.join(__dirname, "fixtures");
const tempDir = path.join(__dirname, "temp");

describe("enable content-negotiation modifiers", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("wraps a plain handle in sequence(handleNegotiate, ...)", async () => {
    const filePath = path.join(tempDir, "hooks.server.ts");
    modifyHooksServerNegotiate(filePath);

    const modified = fs.readFileSync(filePath, "utf8");
    const expected = fs.readFileSync(
      path.join(fixturesPath, "expect", "hooks.server.ts"),
      "utf8",
    );
    await expect(modified).toMatchFormatted(expected, "hooks.server.ts");
  });

  it("prepends handleNegotiate to an existing sequence(...) handle", async () => {
    const filePath = path.join(tempDir, "hooks.server.sequence.ts");
    modifyHooksServerNegotiate(filePath);

    const modified = fs.readFileSync(filePath, "utf8");
    const expected = fs.readFileSync(
      path.join(fixturesPath, "expect", "hooks.server.sequence.ts"),
      "utf8",
    );
    await expect(modified).toMatchFormatted(expected, "hooks.server.ts");
  });

  it("is idempotent for hooks.server.ts", () => {
    const filePath = path.join(tempDir, "hooks.server.ts");
    modifyHooksServerNegotiate(filePath);
    const first = fs.readFileSync(filePath, "utf8");

    modifyHooksServerNegotiate(filePath);
    const second = fs.readFileSync(filePath, "utf8");

    expect(second).toBe(first);
  });

  it("creates src/hooks.ts when missing", () => {
    const hooksPath = path.join(tempDir, "src", "hooks.ts");
    expect(fs.existsSync(hooksPath)).toBe(false);

    modifyHooksNegotiate(hooksPath);

    const written = fs.readFileSync(hooksPath, "utf8");
    expect(written).toContain(
      "import { reroute as negotiateReroute } from '$lib/negotiate';",
    );
    expect(written).toContain(
      "export const reroute = ({ url }) => negotiateReroute(url.pathname);",
    );
  });

  it("composes with an existing i18n reroute", async () => {
    const filePath = path.join(tempDir, "hooks.i18n.ts");
    modifyHooksNegotiate(filePath);

    const modified = fs.readFileSync(filePath, "utf8");
    const expected = fs.readFileSync(
      path.join(fixturesPath, "expect", "hooks.i18n.ts"),
      "utf8",
    );
    await expect(modified).toMatchFormatted(expected, "hooks.ts");
  });

  it("is idempotent after composing with i18n", () => {
    const filePath = path.join(tempDir, "hooks.i18n.ts");

    modifyHooksNegotiate(filePath);
    const first = fs.readFileSync(filePath, "utf8");

    modifyHooksNegotiate(filePath);
    const second = fs.readFileSync(filePath, "utf8");

    expect(second).toBe(first);
  });

  it("refuses to modify an unrecognized reroute", () => {
    const filePath = path.join(tempDir, "hooks.custom.ts");
    const original = fs.readFileSync(filePath, "utf8");

    const outcome = modifyHooksNegotiate(filePath);
    const modified = fs.readFileSync(filePath, "utf8");

    expect(outcome.status).toBe("failed");
    if (outcome.status === "failed") {
      expect(outcome.message).toContain("negotiateReroute");
    }
    expect(modified).toBe(original);
  });

  it("mounts <Negotiate /> in root-layout.svelte", async () => {
    const filePath = path.join(tempDir, "root-layout.svelte");
    modifyRootLayoutNegotiate(filePath);

    const modified = fs.readFileSync(filePath, "utf8");
    const expected = fs.readFileSync(
      path.join(fixturesPath, "expect", "root-layout.svelte"),
      "utf8",
    );
    await expect(modified).toMatchFormatted(expected, "root-layout.svelte");
  });

  it("is idempotent for root-layout.svelte", () => {
    const filePath = path.join(tempDir, "root-layout.svelte");

    modifyRootLayoutNegotiate(filePath);
    const first = fs.readFileSync(filePath, "utf8");

    modifyRootLayoutNegotiate(filePath);
    const second = fs.readFileSync(filePath, "utf8");

    expect(second).toBe(first);
  });
});
