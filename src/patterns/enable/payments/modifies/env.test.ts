import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { modifyEnvVars, unmodifyEnvVars } from "../../../../runtime/env-vars";
import { STRIPE_ENV_VARS, STRIPE_ENV_VAR_NAMES } from "../runtime/env-vars";
import {
  applyEnvEdits,
  removeEnvEdits,
  type EnvEdit,
} from "../../../../runtime/env";

describe("env edits", () => {
  const stripeEdits: EnvEdit[] = [
    { type: "comment", key: "Stripe credentials" },
    { type: "var", key: "STRIPE_SECRET_KEY", value: "sk_test_abc" },
    {
      type: "var",
      key: "PUBLIC_STRIPE_PUBLISHABLE_KEY",
      value: "pk_test_xyz",
    },
    { type: "var", key: "STRIPE_WEBHOOK_SECRET", value: "whsec_123" },
  ];

  it("round-trips apply + remove on empty source", () => {
    const applied = applyEnvEdits("", stripeEdits);
    const removed = removeEnvEdits(applied, stripeEdits);
    expect(removed).toBe("");
  });

  it("round-trips apply + remove preserving surrounding content", () => {
    const before =
      [
        "# App",
        "APP_URL=http://localhost:5173",
        "",
        "# Database",
        "DB_URL=postgres://localhost/app",
      ].join("\n") + "\n";
    const applied = applyEnvEdits(before, stripeEdits);
    const removed = removeEnvEdits(applied, stripeEdits);
    expect(removed).toBe(before);
  });

  it("does not strip key with matching prefix", () => {
    const source =
      [
        "# Stripe credentials",
        "STRIPE_SECRET_KEY=sk_a",
        "STRIPE_SECRET_KEY_V2=sk_b",
      ].join("\n") + "\n";
    const removed = removeEnvEdits(source, [
      { type: "comment", key: "Stripe credentials" },
      { type: "var", key: "STRIPE_SECRET_KEY", value: "sk_a" },
    ]);
    expect(removed).toContain("STRIPE_SECRET_KEY_V2=sk_b");
    expect(removed).not.toMatch(/^STRIPE_SECRET_KEY=/m);
  });

  it("retains orphan comment if other vars remain beneath it", () => {
    const source =
      [
        "# Stripe credentials",
        "STRIPE_SECRET_KEY=sk_a",
        "STRIPE_EXTRA=hello",
      ].join("\n") + "\n";
    const removed = removeEnvEdits(source, [
      { type: "comment", key: "Stripe credentials" },
      { type: "var", key: "STRIPE_SECRET_KEY", value: "sk_a" },
    ]);
    expect(removed).toContain("# Stripe credentials");
    expect(removed).toContain("STRIPE_EXTRA=hello");
  });
});

describe("src/env.ts declarations", () => {
  const preview = readFileSync(
    fileURLToPath(new URL("../preview-modifies/src/env.ts", import.meta.url)),
    "utf8",
  ).replace(/^[ \t]*\/\/ \[!code highlight:\d+\]\n/m, "");

  function project(content: string) {
    const root = mkdtempSync(path.join(tmpdir(), "payments-env-"));
    mkdirSync(path.join(root, "src"));
    writeFileSync(path.join(root, "src", "env.ts"), content);
    return root;
  }

  it("the preview shows what enable writes, and disable takes it back out", () => {
    const root = project(preview);
    try {
      const removed = unmodifyEnvVars(root, STRIPE_ENV_VAR_NAMES);
      expect(removed.outcome).toEqual({ status: "success", changed: true });
      const without = readFileSync(path.join(root, "src", "env.ts"), "utf8");
      for (const name of STRIPE_ENV_VAR_NAMES) {
        expect(without).not.toContain(name);
      }
      expect(without).toContain("POCKETBASE_URL");

      const added = modifyEnvVars(root, STRIPE_ENV_VARS);
      expect(added.modify?.outcome).toEqual({
        status: "success",
        changed: true,
      });
      expect(readFileSync(path.join(root, "src", "env.ts"), "utf8")).toBe(
        preview,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("declares the publishable key public and the others private", () => {
    expect(
      STRIPE_ENV_VARS.filter((spec) => spec.public).map((spec) => spec.name),
    ).toEqual(["PUBLIC_STRIPE_PUBLISHABLE_KEY"]);
  });
});
