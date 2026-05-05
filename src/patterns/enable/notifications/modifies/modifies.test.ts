import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

import { modifyAppLayout } from "./modify-app-layout";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesPath = path.join(__dirname, "fixtures");
const tempDir = path.join(__dirname, "temp");

const appLayoutTestCases = [
  "basic-layout.svelte",
  "already-has-bell.svelte",
  "no-header-layout.svelte",
] as const;

describe("modifyAppLayout", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it.each(appLayoutTestCases)(
    "should modify %s correctly",
    async (testCase) => {
      modifyAppLayout(path.join(tempDir, testCase));

      const modifiedFile = fs.readFileSync(
        path.join(tempDir, testCase),
        "utf8",
      );
      const expectedFile = fs.readFileSync(
        path.join(fixturesPath, "expect", testCase),
        "utf8",
      );

      await expect(modifiedFile).toMatchFormatted(expectedFile, testCase);
    },
  );

  it("returns changed: false when the file already has the bell", () => {
    const filePath = path.join(tempDir, "already-has-bell.svelte");
    const result = modifyAppLayout(filePath);
    expect(result).toEqual({ status: "success", changed: false });
  });

  it("returns failed when the file has no <header> to insert into", () => {
    const filePath = path.join(tempDir, "no-header-layout.svelte");
    const result = modifyAppLayout(filePath);
    expect(result.status).toBe("failed");
  });

  it("returns not-found when the file does not exist", () => {
    const result = modifyAppLayout(path.join(tempDir, "does-not-exist.svelte"));
    expect(result.status).toBe("not-found");
  });
});
