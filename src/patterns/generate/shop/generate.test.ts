import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ALL_FEATURES_OFF } from "../../../../integration/features";
import { InvalidArgumentError } from "../../../core/errors";
import type { Options } from "../../../core/types";
import { generate, shopFiles } from "./generate";
import { assertNoneExist } from "./generate.runtime";

function options(payments: string | undefined, cms = false): Options {
  return {
    argv: [],
    env: "runtime",
    root: "/project",
    features: {
      ...ALL_FEATURES_OFF,
      backend: true,
      payments: true,
      ecommerce: true,
      cms,
    },
    providers: payments ? { payments } : {},
    input: {},
  };
}

// Sorted the same way on both sides: the generator orders by locale.
const paths = (files: { path: string }[]) =>
  files.map((file) => file.path).sort();

describe("generate-shop", () => {
  it("writes Stripe's pages, read from the synced catalog on the server", async () => {
    const result = await generate(options("stripe"));
    expect(paths(result.creates)).toEqual(
      [
        "src/routes/(public)/shop/+page.server.ts",
        "src/routes/(public)/shop/+page.svelte",
        "src/routes/(public)/shop/[product]/+page.server.ts",
        "src/routes/(public)/shop/[product]/+page.svelte",
      ].sort(),
    );
    expect(result.creates[0].content).toContain("stripe_products");
    expect(result.components).toEqual(["button"]);
  });

  it("writes Shopify's pages as universal loads that are not prerendered", async () => {
    const result = await generate(options("shopify"));
    expect(paths(result.creates)).toEqual(
      [
        "src/routes/(public)/shop/+page.svelte",
        "src/routes/(public)/shop/+page.ts",
        "src/routes/(public)/shop/[handle]/+page.svelte",
        "src/routes/(public)/shop/[handle]/+page.ts",
      ].sort(),
    );
    for (const file of result.creates.filter((f) => f.path.endsWith(".ts"))) {
      expect(file.content).toContain("export const prerender = false;");
    }
  });

  it("writes WhatsApp's catalog module and pages, with the CMS pages instead when the CMS is on", async () => {
    const module = await generate(options("whatsapp"));
    expect(paths(module.creates)).toEqual(
      [
        "src/lib/catalog.ts",
        "src/routes/(public)/shop/+page.svelte",
        "src/routes/(public)/shop/[id]/+page.svelte",
        "src/routes/(public)/shop/[id]/+page.ts",
      ].sort(),
    );
    expect(module.creates[0].content).toContain("export const catalog");

    const cms = await generate(options("whatsapp", true));
    expect(paths(cms.creates)).toEqual(
      [
        "src/routes/(public)/shop/+page.svelte",
        "src/routes/(public)/shop/[id]/+page.svelte",
        "src/routes/(public)/shop/[id]/+page.ts",
      ].sort(),
    );
    expect(cms.creates[0].content).toContain("CmsCollection");
    // Prices in the app's own currency, not a CMS option.
    expect(cms.creates[0].content).toContain("#lib/order.js");
  });

  it("follows the payments provider and refuses without one", async () => {
    await expect(generate(options(undefined))).rejects.toThrow(
      "Run `vela enable payments` first.",
    );
    await expect(
      generate({ ...options("stripe"), input: { provider: "shopify" } }),
    ).rejects.toThrow(InvalidArgumentError);
  });

  it("previews Stripe's pages when nothing is detected", async () => {
    const preview = shopFiles({ ...options(undefined), env: "preview" });
    expect(paths(preview)).toContain(
      "src/routes/(public)/shop/+page.server.ts",
    );
  });
});

describe("assertNoneExist", () => {
  const roots: string[] = [];
  afterEach(() => {
    while (roots.length)
      fs.rmSync(roots.pop()!, { recursive: true, force: true });
  });

  it("refuses to write over a file that exists, naming it", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "generate-shop-"));
    roots.push(root);
    const creates = (await generate(options("whatsapp"))).creates;
    expect(() => assertNoneExist(root, creates)).not.toThrow();

    const page = path.join(root, "src/routes/(public)/shop/+page.svelte");
    fs.mkdirSync(path.dirname(page), { recursive: true });
    fs.writeFileSync(page, "<h1>Shop</h1>\n");
    expect(() => assertNoneExist(root, creates)).toThrow(
      "src/routes/(public)/shop/+page.svelte",
    );
    expect(() => assertNoneExist(root, creates)).toThrow("vela destroy shop");
  });
});
