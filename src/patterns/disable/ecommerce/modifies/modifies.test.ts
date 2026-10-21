import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { unmodifyRootLayoutSvelte } from "./root-layout.svelte";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// enable-ecommerce's fixtures run in reverse: its expect is this original.
const enableFixtures = path.join(
  __dirname,
  "../../../enable/ecommerce/modifies/fixtures",
);
const tempDir = path.join(__dirname, "temp");

const cases = [
  "basic-layout.svelte",
  "auth-layout.svelte",
  "spaces-layout.svelte",
] as const;

describe("unmodifyRootLayoutSvelte", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(enableFixtures, "expect"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it.each(cases)("restores %s byte for byte", (testCase) => {
    const outcome = unmodifyRootLayoutSvelte(path.join(tempDir, testCase));
    expect(outcome).toEqual({ status: "success", changed: true });
    expect(fs.readFileSync(path.join(tempDir, testCase), "utf8")).toBe(
      fs.readFileSync(path.join(enableFixtures, "original", testCase), "utf8"),
    );
  });

  it("leaves a layout without the cart alone", () => {
    const file = path.join(tempDir, "no-navbar-layout.svelte");
    expect(unmodifyRootLayoutSvelte(file)).toEqual({
      status: "success",
      changed: false,
    });
  });
});
