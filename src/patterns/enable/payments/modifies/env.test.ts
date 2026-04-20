import { describe, expect, it } from "vitest";
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
