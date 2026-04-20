import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { modifyHooksServer } from "../../../enable/api/modifies/hooks.server";
import { unmodifyHooksServer } from "./hooks.server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const originalFixtures = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "enable",
  "api",
  "modifies",
  "fixtures",
  "original",
);
const tempDir = path.join(__dirname, "temp");

const roundtripCases = [
  "hooks.server.no-options.ts",
  "hooks.server.with-options.ts",
] as const;

describe("disable-api roundtrip", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(originalFixtures, tempDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it.each(roundtripCases)(
    "modify then unmodify returns %s to original",
    async (testCase) => {
      const filePath = path.join(tempDir, testCase);
      const original = fs.readFileSync(filePath, "utf8");

      modifyHooksServer(filePath);
      unmodifyHooksServer(filePath);

      const final = fs.readFileSync(filePath, "utf8");
      await expect(final).toMatchFormatted(original, testCase);
    },
  );
});
