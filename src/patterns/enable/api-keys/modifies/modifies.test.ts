import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { modifyUtils } from "../../../../runtime/modify-utils";
import { modifyHooksServer } from "./hooks.server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesPath = path.join(__dirname, "fixtures");
const tempDir = path.join(__dirname, "temp");

const hooksServerTestCases = [
  "hooks.server.no-options.ts",
  "hooks.server.with-options.ts",
  "hooks.server.with-api.ts",
  "hooks.server.non-object-first-arg.ts",
  "hooks.server.no-handle.ts",
] as const;

describe("modifyHooksServer", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it.each(hooksServerTestCases)(
    "should modify %s correctly",
    async (testCase) => {
      modifyHooksServer(path.join(tempDir, testCase));

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
});

const utilsTestCases = ["utils.baseline.ts", "utils.already-has.ts"] as const;

describe("modifyUtils", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it.each(utilsTestCases)("should modify %s correctly", async (testCase) => {
    modifyUtils(path.join(tempDir, testCase));

    const modifiedFile = fs.readFileSync(path.join(tempDir, testCase), "utf8");
    const expectedFile = fs.readFileSync(
      path.join(fixturesPath, "expect", testCase),
      "utf8",
    );

    await expect(modifiedFile).toMatchFormatted(expectedFile, testCase);
  });

  it("should be idempotent", () => {
    const target = path.join(tempDir, "utils.baseline.ts");
    const first = modifyUtils(target);
    const second = modifyUtils(target);
    expect(first).toEqual({ status: "success", changed: true });
    expect(second).toEqual({ status: "success", changed: false });
  });
});
