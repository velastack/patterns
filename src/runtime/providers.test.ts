import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dedent from "dedent";
import { afterEach, describe, expect, it } from "vitest";
import type { Pattern } from "../core/types";
import { detectProviders } from "./providers";

const roots: string[] = [];

afterEach(() => {
  while (roots.length) {
    fs.rmSync(roots.pop()!, { recursive: true, force: true });
  }
});

function makeRoot(files: Record<string, string> = {}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vela-providers-"));
  roots.push(root);
  for (const [name, content] of Object.entries(files)) {
    const abs = path.join(root, name);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

const envFile = (...names: string[]) => dedent`
  import { defineEnvVars } from '@sveltejs/kit/env';

  export const variables = defineEnvVars({
  ${names.map((name) => `  ${name}: { schema: (value) => value ?? '' },`).join("\n")}
  });
`;

type Detectable = Pick<Pattern, "slug" | "providers" | "inheritsProvider">;

const analytics: Detectable = {
  slug: "enable-analytics",
  providers: [
    {
      id: "plausible",
      label: "Plausible",
      env: [{ key: "PUBLIC_PLAUSIBLE_DOMAIN", label: "Domain" }],
    },
    {
      id: "posthog",
      label: "PostHog",
      env: [{ key: "PUBLIC_POSTHOG_KEY", label: "Key" }],
      markers: [{ dependency: "posthog-js" }],
    },
  ],
};

const payments: Detectable = {
  slug: "enable-payments",
  providers: [
    {
      id: "stripe",
      label: "Stripe",
      env: [{ key: "STRIPE_SECRET_KEY", label: "Secret key" }],
      markers: [
        { env: "STRIPE_SECRET_KEY" },
        { path: "src/routes/webhooks/stripe" },
      ],
    },
    {
      id: "shopify",
      label: "Shopify",
      env: [{ key: "PUBLIC_SHOPIFY_STORE_DOMAIN", label: "Store domain" }],
    },
  ],
};

const ecommerce: Detectable = {
  slug: "enable-ecommerce",
  inheritsProvider: "payments",
  providers: [
    { id: "stripe", label: "Stripe" },
    { id: "shopify", label: "Shopify", markers: [{ path: "src/lib" }] },
  ],
};

const registry = [analytics, payments, ecommerce];

describe("detectProviders", () => {
  it("finds a provider by its env declaration", () => {
    const root = makeRoot({
      "src/env.ts": envFile(
        "PUBLIC_PLAUSIBLE_DOMAIN",
        "PUBLIC_SHOPIFY_STORE_DOMAIN",
      ),
    });
    expect(detectProviders(root, registry)).toEqual({
      providers: { analytics: "plausible", payments: "shopify" },
      ambiguous: [],
    });
  });

  it("finds a provider by a path marker", () => {
    const root = makeRoot({
      "src/routes/webhooks/stripe/+server.ts": "",
    });
    expect(detectProviders(root, registry).providers).toEqual({
      payments: "stripe",
    });
  });

  it("finds a provider by a dependency marker", () => {
    const root = makeRoot({
      "package.json": JSON.stringify({
        devDependencies: { "posthog-js": "^1.0.0" },
      }),
    });
    expect(detectProviders(root, registry).providers).toEqual({
      analytics: "posthog",
    });
  });

  it("reports nothing for a project with no markers", () => {
    expect(detectProviders(makeRoot(), registry)).toEqual({
      providers: {},
      ambiguous: [],
    });
  });

  it("reports a capability whose providers both look present as ambiguous", () => {
    const root = makeRoot({
      "src/env.ts": envFile("STRIPE_SECRET_KEY", "PUBLIC_SHOPIFY_STORE_DOMAIN"),
    });
    expect(detectProviders(root, registry)).toEqual({
      providers: {},
      ambiguous: [{ capability: "payments", ids: ["stripe", "shopify"] }],
    });
  });

  it("skips patterns that inherit their provider", () => {
    // `src/lib` exists, which is ecommerce's Shopify marker; it must not count.
    const root = makeRoot({ "src/lib/index.ts": "" });
    expect(detectProviders(root, registry).providers).toEqual({});
  });

  it("does not fail on a package.json it can't parse", () => {
    const root = makeRoot({ "package.json": "{" });
    expect(detectProviders(root, registry).providers).toEqual({});
  });
});
