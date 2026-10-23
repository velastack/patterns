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

  it("takes the success page's language from the URL only with i18n on", async () => {
    const success = "src/routes/(public)/checkout/success/+page.server.ts";
    const load = async (i18n: boolean) =>
      (
        await generate({
          ...options("stripe"),
          features: { ...options("stripe").features, i18n },
        })
      ).creates.find((file) => file.path === success)!.content;
    expect(await load(false)).toContain("locale: 'en'");
    expect(await load(false)).not.toContain("getLocale");
    expect(await load(true)).toContain("locale: getLocale(url)");
    expect(await load(true)).toContain("#locales/main.url.js");
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

  it("writes the WhatsApp cart for a WhatsApp project, with no demo page", async () => {
    const result = await generate(
      options("whatsapp", { demoId: "ignored on WhatsApp" }),
    );
    expect(paths(result.creates)).toEqual([
      "src/lib/cart.svelte.ts",
      "src/lib/components/cart/add-to-cart.svelte",
      "src/lib/components/cart/cart-button.svelte",
      "src/lib/components/cart/cart-sheet.svelte",
    ]);
  });

  it("adds a demo shop page for the given item", async () => {
    const stripe = await generate(options("stripe", { demoId: "price_123" }));
    const load = stripe.creates.find(
      (file) => file.path === "src/routes/(public)/shop/+page.server.ts",
    );
    expect(load?.content).toContain("getOne('price_123')");
    // A price always has a currency; there is no default to fall back to.
    expect(load?.content).not.toContain("'usd'");

    const shopify = await generate(
      options("shopify", { demoId: "gid://shopify/ProductVariant/9" }),
    );
    expect(paths(shopify.creates)).toContain(
      "src/routes/(public)/shop/+page.svelte",
    );
    expect(paths(shopify.creates)).not.toContain(
      "src/routes/(public)/shop/+page.server.ts",
    );
  });

  it("follows the payments provider, and refuses without one", async () => {
    await expect(generate(options(undefined))).rejects.toThrow(
      "Run `vela enable payments` first.",
    );
    await expect(
      generate(options("stripe", { provider: "shopify" })),
    ).rejects.toThrow(InvalidArgumentError);
  });

  it("previews the Stripe cart with the navbar change", async () => {
    const preview = await generatePreview({
      ...options(undefined),
      env: "preview",
    });
    expect(paths(preview.modifies)).toEqual([
      "src/routes/(public)/root-layout.svelte",
    ]);
    expect(preview.creates[0].content).toContain("price_preview_placeholder");
  });

  it("previews the WhatsApp cart with a priced and a quoted item", async () => {
    const preview = await generatePreview({
      ...options(undefined, { provider: "whatsapp" }),
      env: "preview",
    });
    expect(paths(preview.creates)).toEqual([
      "src/routes/(public)/shop/+page.svelte",
    ]);
    expect(preview.creates[0].content).toContain(
      'name="Sourdough loaf" price={4.5}',
    );
    expect(preview.creates[0].content).toContain('name="Birthday cake" />');
  });
});
