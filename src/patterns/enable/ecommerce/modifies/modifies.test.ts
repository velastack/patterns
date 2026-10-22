import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { modifyRootLayoutSvelte } from "./root-layout.svelte";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(__dirname, "fixtures");
const tempDir = path.join(__dirname, "temp");

// Compared byte for byte, not formatted: a project without prettier keeps
// exactly what the modifier writes.
const cases = [
  ["basic-layout.svelte", "after the last item"],
  ["auth-layout.svelte", "left of the account menu"],
  ["spaces-layout.svelte", "indented with the file's spaces"],
  ["applied-layout.svelte", "once, however often it runs"],
] as const;

describe("modifyRootLayoutSvelte", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it.each(cases)("adds the cart to %s %s", (testCase) => {
    const outcome = modifyRootLayoutSvelte(path.join(tempDir, testCase));
    expect(outcome.status).toBe("success");
    expect(fs.readFileSync(path.join(tempDir, testCase), "utf8")).toBe(
      fs.readFileSync(path.join(fixturesPath, "expect", testCase), "utf8"),
    );
  });

  it("leaves a layout without a Navbar.List alone, with the markup to paste", () => {
    const file = path.join(tempDir, "no-navbar-layout.svelte");
    const before = fs.readFileSync(file, "utf8");
    const outcome = modifyRootLayoutSvelte(file);
    expect(outcome.status).toBe("failed");
    expect(outcome.status === "failed" && outcome.message).toContain(
      "<CartButton />",
    );
    expect(fs.readFileSync(file, "utf8")).toBe(before);
  });

  it("reports a missing layout", () => {
    expect(
      modifyRootLayoutSvelte(path.join(tempDir, "missing.svelte")).status,
    ).toBe("not-found");
  });
});
