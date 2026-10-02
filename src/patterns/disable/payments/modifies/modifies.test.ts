import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unmodifyUserSignup } from "./modify-user-signup";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(__dirname, "fixtures");
// enable-payments' output: the signup action with the Stripe customer queued.
const enabled = path.join(
  __dirname,
  "../../../enable/payments/modifies/fixtures/expect/+page.server.ts",
);
const tempDir = path.join(__dirname, "temp");

describe("disable payments: signup action", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("takes the Stripe customer link out of the signup action", () => {
    const filePath = path.join(tempDir, "+page.server.ts");
    fs.copyFileSync(enabled, filePath);

    expect(unmodifyUserSignup(filePath)).toEqual({
      status: "success",
      changed: true,
    });
    const reverted = fs.readFileSync(filePath, "utf8");
    expect(reverted).not.toContain("linkStripeCustomer");
    expect(reverted).not.toContain("#lib/workflows/link-stripe-customer.js");
  });

  it("takes it out of a legacy signup action (pre-Kit 3 imports)", async () => {
    const filePath = path.join(tempDir, "legacy-+page.server.ts");

    expect(unmodifyUserSignup(filePath)).toEqual({
      status: "success",
      changed: true,
    });
    await expect(fs.readFileSync(filePath, "utf8")).toMatchFormatted(
      fs.readFileSync(
        path.join(fixturesPath, "expect", "legacy-+page.server.ts"),
        "utf8",
      ),
      "+page.server.ts",
    );
  });
});
