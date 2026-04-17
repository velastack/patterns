import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { modifyNavUser } from "./modify-nav-user";
import { modifyUserSignup } from "./modify-user-signup";
import { modifyEnv, type EnvEdit } from "./modify-env";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesPath = path.join(__dirname, "fixtures");
const tempDir = path.join(__dirname, "temp");

const STRIPE_ENV_EDITS: EnvEdit[] = [
  { type: "comment", key: "Stripe credentials" },
  { type: "var", key: "STRIPE_SECRET_KEY", value: "sk_test_fixture" },
  {
    type: "var",
    key: "PUBLIC_STRIPE_PUBLISHABLE_KEY",
    value: "pk_test_fixture",
  },
  { type: "var", key: "STRIPE_WEBHOOK_SECRET", value: "whsec_test_fixture" },
  { type: "var", key: "INTERNAL_JOB_SECRET", value: "job_secret_fixture" },
];

const modifyCases = [
  {
    file: "nav-user.svelte",
    modify: (target: string) => modifyNavUser(target),
  },
  {
    file: "+page.server.ts",
    modify: (target: string) => modifyUserSignup(target),
  },
  {
    file: ".env",
    modify: (target: string) => modifyEnv(target, STRIPE_ENV_EDITS),
  },
] as const;

describe("payments modifies", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it.each(modifyCases)(
    "should modify $file correctly",
    async ({ file, modify }) => {
      const targetPath = path.join(tempDir, file);
      modify(targetPath);

      const modifiedFile = fs.readFileSync(targetPath, "utf8");
      const expectedFile = fs.readFileSync(
        path.join(fixturesPath, "expect", file),
        "utf8",
      );

      await expect(modifiedFile).toMatchFormatted(expectedFile, file);
    },
  );

  it("should be idempotent", async () => {
    const navUserPath = path.join(tempDir, "nav-user.svelte");
    const signupPath = path.join(tempDir, "+page.server.ts");
    const envPath = path.join(tempDir, ".env");

    modifyNavUser(navUserPath);
    modifyUserSignup(signupPath);
    modifyEnv(envPath, STRIPE_ENV_EDITS);

    const firstNavUser = fs.readFileSync(navUserPath, "utf8");
    const firstSignup = fs.readFileSync(signupPath, "utf8");
    const firstEnv = fs.readFileSync(envPath, "utf8");

    expect(modifyNavUser(navUserPath).status).toBe("success");
    expect(modifyUserSignup(signupPath).status).toBe("success");
    expect(modifyEnv(envPath, STRIPE_ENV_EDITS).status).toBe("success");

    expect(fs.readFileSync(navUserPath, "utf8")).toBe(firstNavUser);
    expect(fs.readFileSync(signupPath, "utf8")).toBe(firstSignup);
    expect(fs.readFileSync(envPath, "utf8")).toBe(firstEnv);
  });

  it("reports not-found when targets are missing", () => {
    const missingPath = path.join(tempDir, "does-not-exist.svelte");
    expect(modifyNavUser(missingPath).status).toBe("not-found");
    expect(modifyUserSignup(missingPath).status).toBe("not-found");
  });

  it("creates .env when it doesn't exist", () => {
    const newEnvPath = path.join(tempDir, "fresh.env");
    const outcome = modifyEnv(newEnvPath, STRIPE_ENV_EDITS);
    expect(outcome.status).toBe("success");
    const content = fs.readFileSync(newEnvPath, "utf8");
    expect(content).toContain("STRIPE_SECRET_KEY=sk_test_fixture");
    expect(content).toContain("# Stripe credentials");
  });
});
