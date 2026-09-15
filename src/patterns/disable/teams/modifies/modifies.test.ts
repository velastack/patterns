import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unmodifyLayoutServer } from "./+layout.server";
import { unmodifyAppLayoutSvelte } from "./modify-app-layout";
import { unmodifyAppSidebar } from "./modify-app-sidebar";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesPath = path.join(__dirname, "fixtures");
const tempDir = path.join(__dirname, "temp");

const cases = [
  { file: "+layout.server.ts", unmodify: unmodifyLayoutServer },
  { file: "+layout.svelte", unmodify: unmodifyAppLayoutSvelte },
  { file: "multiline-app-layout.svelte", unmodify: unmodifyAppLayoutSvelte },
  { file: "app-sidebar.svelte", unmodify: unmodifyAppSidebar },
  { file: "spaced-app-sidebar.svelte", unmodify: unmodifyAppSidebar },
] as const;

describe("disable teams modifiers (enable-teams output as input)", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  for (const { file, unmodify } of cases) {
    it(`reverts ${file}`, async () => {
      const filePath = path.join(tempDir, file);
      const outcome = unmodify(filePath);

      expect(outcome).toEqual({ status: "success", changed: true });
      const modified = fs.readFileSync(filePath, "utf8");
      const expected = fs.readFileSync(
        path.join(fixturesPath, "expect", file),
        "utf8",
      );
      await expect(modified).toMatchFormatted(expected, file);
    });

    it(`is idempotent for ${file}`, () => {
      const filePath = path.join(tempDir, file);
      unmodify(filePath);
      const first = fs.readFileSync(filePath, "utf8");

      const outcome = unmodify(filePath);

      expect(outcome).toEqual({ status: "success", changed: false });
      expect(fs.readFileSync(filePath, "utf8")).toBe(first);
    });
  }
});
