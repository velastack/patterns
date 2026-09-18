import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

import { modifyLayoutServer } from "./+layout.server";
import { modifyRootLayoutSvelte } from "./root-layout.svelte";
import { modifyHooksServer } from "./hooks.server";
import { modifyTestSetup } from "./test-setup";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesPath = path.join(__dirname, "fixtures");
const tempDir = path.join(__dirname, "temp");

const layoutServerTestCases = [
  "root-layout.server.ts",
  "basic-layout.server.ts",
  "event-layout.server.ts",
  "does-not-exist.server.ts",
  "non-arrow-layout.server.ts",
  "concise-layout.server.ts",
  "no-param-layout.server.ts",
  "already-has-user.server.ts",
  "root-layout-wrapper.server.ts",
] as const;

const layoutSvelteTestCases = [
  "basic-layout.svelte",
  "no-navbar-layout.svelte",
  "wrapped-layout.svelte",
] as const;

const hooksServerTestCases = ["hooks.server.ts"] as const;

describe("modifyLayoutServer", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it.each(layoutServerTestCases)(
    "should modify %s correctly",
    async (testCase) => {
      modifyLayoutServer(path.join(tempDir, testCase));

      const modifiedFilePath = path.join(tempDir, testCase);
      const modifiedFile = fs.readFileSync(modifiedFilePath, "utf8");
      const expectedFile = fs.readFileSync(
        path.join(fixturesPath, "expect", testCase),
        "utf8",
      );

      await expect(modifiedFile).toMatchFormatted(expectedFile, testCase);
    },
  );
});

describe("modifyLayoutSvelte", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it.each(layoutSvelteTestCases)(
    "should modify %s correctly",
    async (testCase) => {
      modifyRootLayoutSvelte(path.join(tempDir, testCase));

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

describe("modifyTestSetup", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("logs the test agent in with the pb_auth cookie instead of the form action", async () => {
    const file = path.join(tempDir, "test-setup.ts");
    expect(modifyTestSetup(file)).toEqual({ status: "success", changed: true });

    const expectedFile = fs.readFileSync(
      path.join(fixturesPath, "expect", "test-setup.ts"),
      "utf8",
    );
    await expect(fs.readFileSync(file, "utf8")).toMatchFormatted(
      expectedFile,
      "test-setup.ts",
    );

    // Already converted: nothing left to do.
    expect(modifyTestSetup(file)).toEqual({
      status: "success",
      changed: false,
    });
  });

  it("leaves a project without the server-test helper alone", () => {
    expect(modifyTestSetup(path.join(tempDir, "missing.ts"))).toEqual({
      status: "success",
      changed: false,
    });
  });
});
