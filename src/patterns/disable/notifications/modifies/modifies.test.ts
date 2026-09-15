import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unmodifyAppLayout } from "./modify-app-layout";
import { unmodifyLayoutServer } from "./+layout.server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesPath = path.join(__dirname, "fixtures");
const tempDir = path.join(__dirname, "temp");

const expected = (name: string) =>
  fs.readFileSync(path.join(fixturesPath, "expect", name), "utf8");

describe("disable notifications modifiers", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("takes the bell out of the (app) layout header", async () => {
    const filePath = path.join(tempDir, "basic-layout.svelte");
    const outcome = unmodifyAppLayout(filePath);

    expect(outcome).toEqual({ status: "success", changed: true });
    await expect(fs.readFileSync(filePath, "utf8")).toMatchFormatted(
      expected("basic-layout.svelte"),
      "basic-layout.svelte",
    );
  });

  it("leaves a layout without the bell alone", () => {
    const filePath = path.join(tempDir, "no-header-layout.svelte");
    const before = fs.readFileSync(filePath, "utf8");

    expect(unmodifyAppLayout(filePath)).toEqual({
      status: "success",
      changed: false,
    });
    expect(fs.readFileSync(filePath, "utf8")).toBe(before);
  });

  it("takes the notifications query out of the (app) layout load", async () => {
    const filePath = path.join(tempDir, "+layout.server.ts");
    const outcome = unmodifyLayoutServer(filePath);

    expect(outcome).toEqual({ status: "success", changed: true });
    await expect(fs.readFileSync(filePath, "utf8")).toMatchFormatted(
      expected("+layout.server.ts"),
      "+layout.server.ts",
    );
  });

  it("is idempotent for +layout.server.ts", () => {
    const filePath = path.join(tempDir, "+layout.server.ts");
    unmodifyLayoutServer(filePath);
    const first = fs.readFileSync(filePath, "utf8");

    expect(unmodifyLayoutServer(filePath)).toEqual({
      status: "success",
      changed: false,
    });
    expect(fs.readFileSync(filePath, "utf8")).toBe(first);
  });
});
