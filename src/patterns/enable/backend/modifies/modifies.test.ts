import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

import { HOOKS_SERVER_SNIPPET } from "../../i18n/modifies/hooks.server";
import { modifyHooksServerBackend } from "./hooks.server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesPath = path.join(__dirname, "fixtures");
const tempDir = path.join(__dirname, "temp");

const expected = (name: string) =>
  fs.readFileSync(path.join(fixturesPath, "expect", name), "utf8");

/** What the create writes into a project with no hooks.server.ts. */
const CREATED = fs.readFileSync(
  path.join(__dirname, "..", "creates", "src", "hooks.server.ts"),
  "utf8",
);

describe("enable backend hooks.server.ts", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("leaves a missing file to the create", () => {
    const filePath = path.join(tempDir, "missing.hooks.server.ts");
    expect(modifyHooksServerBackend(filePath)).toEqual({
      status: "success",
      changed: false,
    });
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("turns the static template's hooks into exactly what the create writes", async () => {
    const filePath = path.join(tempDir, "static.hooks.server.ts");
    expect(modifyHooksServerBackend(filePath)).toEqual({
      status: "success",
      changed: true,
    });
    await expect(fs.readFileSync(filePath, "utf8")).toMatchFormatted(
      CREATED,
      "hooks.server.ts",
    );
  });

  it("keeps the i18n handle of a static site and swaps handleStatic in place", async () => {
    const filePath = path.join(tempDir, "static-i18n.hooks.server.ts");
    modifyHooksServerBackend(filePath);
    await expect(fs.readFileSync(filePath, "utf8")).toMatchFormatted(
      expected("static-i18n.hooks.server.ts"),
      "hooks.server.ts",
    );
  });

  it("composes into the file enable-i18n created on a bare project", async () => {
    const filePath = path.join(tempDir, "bare-i18n.hooks.server.ts");
    fs.writeFileSync(filePath, HOOKS_SERVER_SNIPPET + "\n");

    modifyHooksServerBackend(filePath);

    const modified = fs.readFileSync(filePath, "utf8");
    expect(modified).toContain("loadLocales(main.key");
    expect(modified).toContain(
      "import { handlePocketbase } from '@velastack/pocketbase';",
    );
    expect(modified).toContain("import { env } from '$env/dynamic/private';");
    expect(modified).toMatch(
      /export const handle = sequence\(\s*handleWuchale,\s*handlePocketbase\(\{/,
    );
  });

  it("moves a handle written as a function aside and runs PocketBase after it", async () => {
    const filePath = path.join(tempDir, "function.hooks.server.ts");
    modifyHooksServerBackend(filePath);
    await expect(fs.readFileSync(filePath, "utf8")).toMatchFormatted(
      expected("function.hooks.server.ts"),
      "hooks.server.ts",
    );
  });

  it("leaves hooks that already have the PocketBase handle alone", () => {
    const filePath = path.join(tempDir, "minimal.hooks.server.ts");
    const before = fs.readFileSync(filePath, "utf8");
    expect(modifyHooksServerBackend(filePath)).toEqual({
      status: "success",
      changed: false,
    });
    expect(fs.readFileSync(filePath, "utf8")).toBe(before);
  });

  it("is idempotent", () => {
    const filePath = path.join(tempDir, "static-i18n.hooks.server.ts");
    modifyHooksServerBackend(filePath);
    const once = fs.readFileSync(filePath, "utf8");

    expect(modifyHooksServerBackend(filePath)).toEqual({
      status: "success",
      changed: false,
    });
    expect(fs.readFileSync(filePath, "utf8")).toBe(once);
  });

  it("reports failure for a re-exported handle and leaves it", () => {
    const filePath = path.join(tempDir, "reexport.hooks.server.ts");
    const original = `export { handle } from './other';\n`;
    fs.writeFileSync(filePath, original);

    const outcome = modifyHooksServerBackend(filePath);

    expect(outcome.status).toBe("failed");
    if (outcome.status === "failed") {
      expect(outcome.message).toContain("handlePocketbase");
    }
    expect(fs.readFileSync(filePath, "utf8")).toBe(original);
  });
});
