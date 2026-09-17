import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { modifyHooksServerWorkflows } from "./hooks.server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(__dirname, "fixtures");
const tempDir = path.join(__dirname, "temp");

describe("enable workflows modifiers", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("adds the init hook to the minimal hooks.server.ts", async () => {
    const filePath = path.join(tempDir, "hooks.server.ts");
    expect(modifyHooksServerWorkflows(filePath)).toEqual({
      status: "success",
      changed: true,
    });

    const modified = fs.readFileSync(filePath, "utf8");
    const expected = fs.readFileSync(
      path.join(fixturesPath, "expect", "hooks.server.ts"),
      "utf8",
    );
    await expect(modified).toMatchFormatted(expected, "hooks.server.ts");
  });

  it("adds the init hook after a sequence() handle and joins the kit type import", async () => {
    const filePath = path.join(tempDir, "sequence.hooks.server.ts");
    expect(modifyHooksServerWorkflows(filePath)).toEqual({
      status: "success",
      changed: true,
    });

    const modified = fs.readFileSync(filePath, "utf8");
    const expected = fs.readFileSync(
      path.join(fixturesPath, "expect", "sequence.hooks.server.ts"),
      "utf8",
    );
    await expect(modified).toMatchFormatted(expected, "hooks.server.ts");
  });

  it("leaves a file that already starts the worker alone", () => {
    const filePath = path.join(tempDir, "hooks.server.ts");
    modifyHooksServerWorkflows(filePath);
    const once = fs.readFileSync(filePath, "utf8");
    expect(modifyHooksServerWorkflows(filePath)).toEqual({
      status: "success",
      changed: false,
    });
    expect(fs.readFileSync(filePath, "utf8")).toBe(once);
  });

  it("refuses to touch a file with its own init hook", () => {
    const filePath = path.join(tempDir, "init.hooks.server.ts");
    const before = fs.readFileSync(filePath, "utf8");
    const outcome = modifyHooksServerWorkflows(filePath);
    expect(outcome.status).toBe("failed");
    expect(outcome).toMatchObject({
      message: expect.stringContaining("already exports an init hook"),
    });
    expect(fs.readFileSync(filePath, "utf8")).toBe(before);
  });

  it("reports a missing file", () => {
    const outcome = modifyHooksServerWorkflows(
      path.join(tempDir, "missing.ts"),
    );
    expect(outcome.status).toBe("not-found");
  });
});
