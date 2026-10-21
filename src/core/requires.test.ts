import { describe, expect, it } from "vitest";
import { unmetRequirements } from "./requires";
import type { DetectedProviders, Features, Requires } from "./types";

const NONE: Features = {
  auth: false,
  api: false,
  apiKeys: false,
  backend: false,
  i18n: false,
  teams: false,
  payments: false,
  blog: false,
  contentNegotiation: false,
  cms: false,
  workflows: false,
};

const requires = (flags: Partial<Requires> = {}): Requires => ({
  ...NONE,
  ...flags,
});

const detected = (
  providers: Record<string, string> = {},
  ambiguous: DetectedProviders["ambiguous"] = [],
): DetectedProviders => ({ providers, ambiguous });

describe("unmetRequirements", () => {
  it("reports each true flag the project lacks, in declaration order", () => {
    expect(
      unmetRequirements(
        { requires: requires({ auth: true, backend: true, payments: true }) },
        { features: { ...NONE, backend: true }, detected: detected() },
      ),
    ).toEqual([
      { kind: "feature", feature: "auth" },
      { kind: "feature", feature: "payments" },
    ]);
  });

  it("treats false as not required", () => {
    expect(
      unmetRequirements(
        { requires: requires() },
        {
          features: { ...NONE, auth: true, teams: true },
          detected: detected(),
        },
      ),
    ).toEqual([]);
  });

  it("leaves ui to its own check", () => {
    expect(
      unmetRequirements(
        { requires: requires({ ui: "shadcn" }) },
        { features: { ...NONE, ui: "plain" }, detected: detected() },
      ),
    ).toEqual([]);
  });

  it("treats a missing optional feature as absent", () => {
    const { workflows: _workflows, ...withoutWorkflows } = NONE;
    expect(
      unmetRequirements(
        { requires: requires({ workflows: true }) },
        { features: withoutWorkflows, detected: detected() },
      ),
    ).toEqual([{ kind: "feature", feature: "workflows" }]);
  });

  it("checks a capability's provider against the pattern's list", () => {
    const subscriptions = {
      requires: requires({
        payments: true,
        providers: { payments: ["stripe"] },
      }),
    };
    const features = { ...NONE, payments: true };

    expect(
      unmetRequirements(subscriptions, {
        features,
        detected: detected({ payments: "stripe" }),
      }),
    ).toEqual([]);
    expect(
      unmetRequirements(subscriptions, {
        features,
        detected: detected({ payments: "shopify" }),
      }),
    ).toEqual([
      {
        kind: "provider",
        capability: "payments",
        want: ["stripe"],
        have: "shopify",
      },
    ]);
  });

  it("does not report a provider for a capability already missing as a feature", () => {
    expect(
      unmetRequirements(
        {
          requires: requires({
            payments: true,
            providers: { payments: ["stripe"] },
          }),
        },
        { features: NONE, detected: detected() },
      ),
    ).toEqual([{ kind: "feature", feature: "payments" }]);
  });

  it("adds the chosen provider's own requirements", () => {
    const payments = {
      requires: requires(),
      providers: [
        {
          id: "stripe",
          label: "Stripe",
          requires: { backend: true, workflows: true },
        },
        { id: "shopify", label: "Shopify" },
      ],
    };

    expect(
      unmetRequirements(payments, {
        features: NONE,
        detected: detected(),
        provider: "stripe",
      }),
    ).toEqual([
      { kind: "feature", feature: "backend" },
      { kind: "feature", feature: "workflows" },
    ]);
    expect(
      unmetRequirements(payments, {
        features: NONE,
        detected: detected(),
        provider: "shopify",
      }),
    ).toEqual([]);
  });

  it("uses the detected provider for an inheriting pattern", () => {
    const ecommerce = {
      requires: requires({ payments: true }),
      inheritsProvider: "payments",
      providers: [
        { id: "stripe", label: "Stripe", requires: { backend: true } },
        { id: "shopify", label: "Shopify" },
      ],
    };
    const features = { ...NONE, payments: true };

    expect(
      unmetRequirements(ecommerce, {
        features,
        detected: detected({ payments: "stripe" }),
      }),
    ).toEqual([{ kind: "feature", feature: "backend" }]);
    expect(
      unmetRequirements(ecommerce, {
        features,
        detected: detected({ payments: "paddle" }),
      }),
    ).toEqual([
      {
        kind: "provider",
        capability: "payments",
        want: ["stripe", "shopify"],
        have: "paddle",
      },
    ]);
  });

  it("reports an ambiguous capability the pattern depends on", () => {
    expect(
      unmetRequirements(
        {
          requires: requires({
            payments: true,
            providers: { payments: ["stripe"] },
          }),
        },
        {
          features: { ...NONE, payments: true },
          detected: detected({}, [
            { capability: "payments", ids: ["stripe", "shopify"] },
          ]),
        },
      ),
    ).toEqual([
      {
        kind: "ambiguous",
        capability: "payments",
        ids: ["stripe", "shopify"],
      },
    ]);
  });

  it("ignores ambiguity in a capability the pattern does not use", () => {
    expect(
      unmetRequirements(
        { requires: requires() },
        {
          features: NONE,
          detected: detected({}, [
            { capability: "analytics", ids: ["plausible", "posthog"] },
          ]),
        },
      ),
    ).toEqual([]);
  });
});
