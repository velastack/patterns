import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { modifyHooksServer } from "../../../enable/api-keys/modifies/hooks.server";
import { unmodifyHooksServer } from "./hooks.server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const originalFixtures = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "enable",
  "api-keys",
  "modifies",
  "fixtures",
  "original",
);
const tempDir = path.join(__dirname, "temp");

describe("disable-api-keys hooks.server roundtrip", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(originalFixtures, tempDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("with-api: enable-api-keys + disable-api-keys returns to api-enabled state", async () => {
    const testCase = "hooks.server.with-api.ts";
    const filePath = path.join(tempDir, testCase);
    const original = fs.readFileSync(filePath, "utf8");

    modifyHooksServer(filePath);
    unmodifyHooksServer(filePath);

    const final = fs.readFileSync(filePath, "utf8");
    await expect(final).toMatchFormatted(original, testCase);
  });
});
