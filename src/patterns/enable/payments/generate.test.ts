import { describe, expect, it } from "vitest";
import { ALL_FEATURES_OFF } from "../../../../integration/features";
import type { Options } from "../../../core/types";
import { generate } from "./generate";
import { generate as generatePreview } from "./generate.preview";

function options(provider: string, auth = false): Options {
  return {
    argv: [],
    env: "runtime",
    root: "/project",
    features: { ...ALL_FEATURES_OFF, backend: true, auth },
    input: { provider },
  };
}

const paths = (files: { path: string }[]) => files.map((file) => file.path);

describe("enable-payments generate", () => {
  it("creates Stripe's files, with the app-mode set only when auth is on", async () => {
    const plain = await generate(options("stripe"));
    expect(paths(plain.creates)).toContain("src/lib/stripe.ts");
    expect(paths(plain.creates)).not.toContain(
      "src/lib/server/stripe-customer.ts",
    );
    expect(plain.packages).toEqual(["stripe", "@stripe/stripe-js"]);
    expect(plain.components).toEqual(["dialog", "input", "label"]);

    const app = await generate(options("stripe", true));
    expect(paths(app.creates)).toContain("src/lib/server/stripe-customer.ts");
    expect(app.components).toContain("alert-dialog");
    // The app-mode dispatcher replaces the base one rather than adding a copy.
    expect(
      paths(app.creates).filter((path) => path.endsWith("dispatch.ts")),
    ).toHaveLength(1);
  });

  it("creates only Shopify's files for Shopify, auth or not", async () => {
    for (const auth of [false, true]) {
      const result = await generate(options("shopify", auth));
      expect(paths(result.creates)).toEqual([
        "src/lib/components/payments/buy-button.svelte",
        "src/lib/shopify.ts",
      ]);
      expect(result.packages).toEqual(["@shopify/storefront-api-client"]);
      expect(result.components).toEqual(["button"]);
    }
  });

  it("previews Stripe by default and Shopify without collections", async () => {
    const preview = (input: Record<string, unknown>) =>
      generatePreview({ ...options("stripe"), env: "preview", input });

    const stripe = await preview({});
    expect(stripe.collections.map((c) => c.name)).toContain("stripe_prices");
    expect(stripe.creates[0].content).toContain("PaymentButton");

    const shopify = await preview({ provider: "shopify" });
    expect(shopify.collections).toEqual([]);
    expect(shopify.creates[0].content).toContain("BuyButton");
    expect(paths(shopify.modifies)).toEqual([".env", "src/env.ts"]);
  });
});
