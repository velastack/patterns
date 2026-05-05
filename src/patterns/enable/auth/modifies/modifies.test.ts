import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

import { modifyLayoutServer } from "./+layout.server";
import { modifyRootLayoutSvelte } from "./root-layout.svelte";
import { modifyHooksServer } from "./hooks.server";
import { modifySidebarMenuButton } from "./sidebar-menu-button.svelte";

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

const sidebarMenuButtonTestCases = [
  "sidebar-menu-button.svelte",
  "sidebar-menu-button-double-quotes.svelte",
] as const;

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

describe("modifySidebarMenuButton", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it.each(sidebarMenuButtonTestCases)(
    "should modify %s correctly",
    async (testCase) => {
      modifySidebarMenuButton(path.join(tempDir, testCase));

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

  it("returns changed: false when the file is already up to date", () => {
    const filePath = path.join(tempDir, "sidebar-menu-button.svelte");
    fs.cpSync(
      path.join(fixturesPath, "expect", "sidebar-menu-button.svelte"),
      filePath,
    );
    const result = modifySidebarMenuButton(filePath);
    expect(result).toEqual({ status: "success", changed: false });
  });

  it("returns not-found when the file does not exist", () => {
    const result = modifySidebarMenuButton(
      path.join(tempDir, "does-not-exist.svelte"),
    );
    expect(result.status).toBe("not-found");
  });
});
