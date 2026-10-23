import { describe, expect, it } from "vitest";
import { ALL_FEATURES_OFF } from "../../../../integration/features";
import { InvalidArgumentError } from "../../../core/errors";
import type { Options } from "../../../core/types";
import { generate } from "./generate";
import { generate as generatePreview } from "./generate.preview";

function options(
  payments: string | undefined,
  input: Record<string, unknown> = {},
): Options {
  return {
    argv: [],
    env: "runtime",
    root: "/project",
    features: { ...ALL_FEATURES_OFF, backend: true, payments: true },
    providers: payments ? { payments } : {},
    input,
  };
}

const paths = (files: { path: string }[]) => files.map((file) => file.path);

describe("enable-ecommerce generate", () => {
  it("writes the Stripe cart for a Stripe project", async () => {
    const result = await generate(options("stripe"));
    expect(paths(result.creates)).toEqual([
      "src/lib/cart.svelte.ts",
      "src/lib/components/cart/add-to-cart.svelte",
      "src/lib/components/cart/cart-button.svelte",
      "src/lib/components/cart/cart-items.svelte",
      "src/lib/components/cart/cart-sheet.svelte",
      "src/routes/(public)/cart/+page.server.ts",
      "src/routes/(public)/cart/+page.svelte",
      "src/routes/(public)/cart/server.test.ts",
      "src/routes/(public)/checkout/success/+page.server.ts",
      "src/routes/(public)/checkout/success/+page.svelte",
    ]);
    expect(result.components).toEqual([
      "sheet",
      "button",
      "badge",
      "separator",
    ]);
    expect(result.packages).toEqual([]);
  });

  it("checks out as the Stripe customer only where payments has the helper", async () => {
    const action = async (stripeCustomer: boolean) =>
      (await generate(options("stripe"), { stripeCustomer })).creates.find(
        (file) => file.path === "src/routes/(public)/cart/+page.server.ts",
      )!.content;
    expect(await action(false)).not.toContain("getStripeCustomerId");
    expect(await action(true)).toContain("getStripeCustomerId");
  });

  it("writes the Shopify cart for a Shopify project, with no server routes", async () => {
    const result = await generate(options("shopify"));
    expect(paths(result.creates)).toEqual([
      "src/lib/cart.svelte.ts",
      "src/lib/components/cart/add-to-cart.svelte",
      "src/lib/components/cart/cart-button.svelte",
      "src/lib/components/cart/cart-sheet.svelte",
    ]);
  });

  it("writes the WhatsApp cart for a WhatsApp project", async () => {
    const result = await generate(options("whatsapp"));
    expect(paths(result.creates)).toEqual([
      "src/lib/cart.svelte.ts",
      "src/lib/components/cart/add-to-cart.svelte",
      "src/lib/components/cart/cart-button.svelte",
      "src/lib/components/cart/cart-sheet.svelte",
    ]);
  });

  it("follows the payments provider, and refuses without one", async () => {
    await expect(generate(options(undefined))).rejects.toThrow(
      "Run `vela enable payments` first.",
    );
    await expect(
      generate(options("stripe", { provider: "shopify" })),
    ).rejects.toThrow(InvalidArgumentError);
  });

  it("previews the navbar change, and the cart of the provider asked for", async () => {
    const preview = await generatePreview({
      ...options(undefined),
      env: "preview",
    });
    expect(paths(preview.modifies)).toEqual([
      "src/routes/(public)/root-layout.svelte",
    ]);
    expect(preview.creates).toEqual([]);
    const whatsapp = await generate({
      ...options(undefined, { provider: "whatsapp" }),
      env: "preview",
    });
    expect(whatsapp.creates[0].content).toContain("orderSubtotal");
  });
});
