import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unmodifyUserSignup } from "./modify-user-signup";
import { modifyUserSignup } from "../../../enable/payments/modifies/modify-user-signup";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(__dirname, "fixtures");
// enable-payments' output: the signup action with the Stripe customer queued.
const enabled = path.join(
  __dirname,
  "../../../enable/payments/modifies/fixtures/expect/+page.server.ts",
);
// The stock signup action, as enable-auth writes it.
const stock = path.join(
  __dirname,
  "../../../enable/auth/creates/src/routes/(public)/(auth)/signup/+page.server.ts",
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

  it("puts the stock signup action back, byte for byte", () => {
    // enable-whatsapp swaps the signup form only while it matches a known
    // original: the comment lines above the hook must go with it, and the
    // blank line after the imports must stay.
    const filePath = path.join(tempDir, "+page.server.ts");
    fs.copyFileSync(stock, filePath);
    expect(modifyUserSignup(filePath).status).toBe("success");

    expect(unmodifyUserSignup(filePath)).toEqual({
      status: "success",
      changed: true,
    });
    expect(fs.readFileSync(filePath, "utf8")).toBe(
      fs.readFileSync(stock, "utf8"),
    );
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
