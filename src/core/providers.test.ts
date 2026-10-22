import { describe, expect, it } from "vitest";
import { InvalidArgumentError } from "./errors";
import {
  allProviderPaths,
  capabilityName,
  providerCreates,
  providerEnvEdits,
  providerEnvVars,
  providerFromArgv,
  providerMarkers,
  resolveProvider,
  suppliedProviderEnv,
  unknownProviderMessage,
} from "./providers";
import type { Provider } from "./types";

const PROVIDERS: Provider[] = [
  { id: "plausible", label: "Plausible" },
  { id: "google", label: "Google Analytics" },
  { id: "posthog", label: "PostHog" },
];

const pattern = { slug: "enable-analytics", providers: PROVIDERS };

function options(
  input: Record<string, unknown> = {},
  argv: string[] = [],
  env: "runtime" | "preview" = "runtime",
) {
  return { input, argv, env };
}

describe("capabilityName", () => {
  it("strips the enable- prefix", () => {
    expect(capabilityName("enable-analytics")).toBe("analytics");
    expect(capabilityName("generate-form")).toBe("generate-form");
  });
});

describe("providerFromArgv", () => {
  it("reads --provider <id>", () => {
    expect(providerFromArgv(["--provider", "google"])).toBe("google");
  });

  it("reads --provider=<id>", () => {
    expect(providerFromArgv(["--other", "--provider=posthog"])).toBe("posthog");
  });

  it("returns undefined when absent", () => {
    expect(providerFromArgv(["--other", "x"])).toBeUndefined();
    expect(providerFromArgv([])).toBeUndefined();
  });
});

describe("unknownProviderMessage", () => {
  it("names the capability and lists each provider on its own line", () => {
    expect(unknownProviderMessage("analytics", "foo", PROVIDERS)).toBe(
      [
        'Unknown provider "foo" for analytics.',
        "",
        "Available providers:",
        "  plausible",
        "  google",
        "  posthog",
      ].join("\n"),
    );
  });
});

describe("resolveProvider", () => {
  it("returns the provider named by input.provider", () => {
    expect(resolveProvider(pattern, options({ provider: "google" }))).toBe(
      PROVIDERS[1],
    );
  });

  it("falls back to --provider in argv", () => {
    expect(
      resolveProvider(pattern, options({}, ["--provider", "posthog"])),
    ).toBe(PROVIDERS[2]);
  });

  it("prefers input.provider over argv", () => {
    expect(
      resolveProvider(
        pattern,
        options({ provider: "plausible" }, ["--provider", "posthog"]),
      ),
    ).toBe(PROVIDERS[0]);
  });

  it("rejects an unknown provider with the list of known ones", () => {
    expect(() =>
      resolveProvider(pattern, options({ provider: "foo" })),
    ).toThrow(InvalidArgumentError);
    expect(() =>
      resolveProvider(pattern, options({ provider: "foo" })),
    ).toThrow(
      'Unknown provider "foo" for analytics.\n\nAvailable providers:\n  plausible\n  google\n  posthog',
    );
  });

  it("rejects a missing provider at runtime, naming the flag", () => {
    expect(() => resolveProvider(pattern, options())).toThrow(
      InvalidArgumentError,
    );
    expect(() => resolveProvider(pattern, options())).toThrow(
      "--provider <plausible|google|posthog>",
    );
    expect(() => resolveProvider(pattern, options({ provider: "" }))).toThrow(
      InvalidArgumentError,
    );
  });

  it("defaults to the first provider in preview", () => {
    expect(resolveProvider(pattern, options({}, [], "preview"))).toBe(
      PROVIDERS[0],
    );
  });

  it("still rejects an unknown provider in preview", () => {
    expect(() =>
      resolveProvider(pattern, options({ provider: "foo" }, [], "preview")),
    ).toThrow(InvalidArgumentError);
  });

  it("throws for a pattern that declares no providers", () => {
    expect(() =>
      resolveProvider(
        { slug: "enable-auth" },
        options({ provider: "plausible" }),
      ),
    ).toThrow("enable-auth declares no providers.");
  });
});

describe("providerCreates", () => {
  const raw = {
    "./providers/plausible/src/lib/b.ts": "plausible-b",
    "./providers/plausible/src/lib/a.svelte": "plausible-a",
    "./providers/google/src/lib/a.svelte": "google-a",
  };

  it("returns only the chosen provider's files, prefix stripped and sorted", () => {
    expect(providerCreates(raw, "plausible")).toEqual([
      {
        path: "src/lib/a.svelte",
        language: "svelte",
        content: "plausible-a",
        status: "success",
      },
      {
        path: "src/lib/b.ts",
        language: "ts",
        content: "plausible-b",
        status: "success",
      },
    ]);
  });

  it("returns nothing for an unknown provider", () => {
    expect(providerCreates(raw, "missing")).toEqual([]);
  });
});

describe("providerEnvVars", () => {
  it("declares each env var optional, public only where the provider says so", () => {
    expect(
      providerEnvVars({
        id: "posthog",
        label: "PostHog",
        env: [
          {
            key: "PUBLIC_POSTHOG_KEY",
            label: "PostHog project key",
            public: true,
          },
          { key: "POSTHOG_PERSONAL_KEY", label: "Personal key", secret: true },
        ],
      }),
    ).toEqual([
      {
        name: "PUBLIC_POSTHOG_KEY",
        public: true,
        description: "PostHog project key",
      },
      { name: "POSTHOG_PERSONAL_KEY", description: "Personal key" },
    ]);
  });

  it("declares nothing for a provider without env vars", () => {
    expect(providerEnvVars({ id: "x", label: "X" })).toEqual([]);
  });
});

describe("resolveProvider with inheritsProvider", () => {
  const STRIPE: Provider = { id: "stripe", label: "Stripe" };
  const SHOPIFY: Provider = { id: "shopify", label: "Shopify" };
  const ecommerce = {
    slug: "enable-ecommerce",
    providers: [STRIPE, SHOPIFY],
    inheritsProvider: "payments",
  };

  function inherited(
    detected: Record<string, string> | undefined,
    input: Record<string, unknown> = {},
    env: "runtime" | "preview" = "runtime",
  ) {
    return { input, argv: [], env, providers: detected };
  }

  it("takes the provider detected for the capability", () => {
    expect(resolveProvider(ecommerce, inherited({ payments: "shopify" }))).toBe(
      SHOPIFY,
    );
  });

  it("accepts a --provider that repeats the detected one", () => {
    expect(
      resolveProvider(
        ecommerce,
        inherited({ payments: "stripe" }, { provider: "stripe" }),
      ),
    ).toBe(STRIPE);
  });

  it("rejects a --provider that differs from the detected one", () => {
    const run = () =>
      resolveProvider(
        ecommerce,
        inherited({ payments: "stripe" }, { provider: "shopify" }),
      );
    expect(run).toThrow(InvalidArgumentError);
    expect(run).toThrow(
      "This project uses Stripe payments, and ecommerce follows it. Leave out --provider, or pass --provider stripe.",
    );
  });

  it("rejects a detected provider the pattern does not support", () => {
    expect(() =>
      resolveProvider(ecommerce, inherited({ payments: "paddle" })),
    ).toThrow('ecommerce does not support "paddle" payments yet.');
  });

  it("asks for the capability first when nothing is detected at runtime", () => {
    for (const detected of [undefined, {}]) {
      expect(() => resolveProvider(ecommerce, inherited(detected))).toThrow(
        "ecommerce is built on payments, and this project has none. Run `vela enable payments` first.",
      );
    }
  });

  it("falls back to the first provider in preview", () => {
    expect(
      resolveProvider(ecommerce, inherited(undefined, {}, "preview")),
    ).toBe(STRIPE);
    expect(
      resolveProvider(
        ecommerce,
        inherited(undefined, { provider: "shopify" }, "preview"),
      ),
    ).toBe(SHOPIFY);
  });
});

describe("providerMarkers", () => {
  it("defaults to the first env key's declaration", () => {
    expect(
      providerMarkers({
        id: "posthog",
        label: "PostHog",
        env: [
          { key: "PUBLIC_POSTHOG_KEY", label: "Key" },
          { key: "PUBLIC_POSTHOG_HOST", label: "Host" },
        ],
      }),
    ).toEqual([{ env: "PUBLIC_POSTHOG_KEY" }]);
  });

  it("uses declared markers as they are", () => {
    const markers = [
      { env: "STRIPE_SECRET_KEY" },
      { path: "src/routes/webhooks/stripe" },
    ];
    expect(
      providerMarkers({
        id: "stripe",
        label: "Stripe",
        env: [{ key: "OTHER", label: "Other" }],
        markers,
      }),
    ).toBe(markers);
  });

  it("is empty for a provider with neither", () => {
    expect(providerMarkers({ id: "x", label: "X" })).toEqual([]);
  });
});

describe("providerEnvEdits", () => {
  const posthog: Provider = {
    id: "posthog",
    label: "PostHog",
    env: [
      { key: "PUBLIC_POSTHOG_KEY", label: "Key", placeholder: "phc_..." },
      { key: "PUBLIC_POSTHOG_HOST", label: "Host", default: "https://x.test" },
    ],
  };

  it("writes the heading, then each key: supplied, else default, else blank", () => {
    expect(
      providerEnvEdits(posthog, "PostHog analytics", {
        PUBLIC_POSTHOG_KEY: "  phc_123  ",
      }),
    ).toEqual([
      { type: "comment", key: "PostHog analytics" },
      { type: "var", key: "PUBLIC_POSTHOG_KEY", value: "phc_123" },
      { type: "var", key: "PUBLIC_POSTHOG_HOST", value: "https://x.test" },
    ]);
  });

  it("never writes a placeholder", () => {
    expect(providerEnvEdits(posthog, "PostHog analytics")[1]).toEqual({
      type: "var",
      key: "PUBLIC_POSTHOG_KEY",
      value: "",
    });
  });
});

describe("suppliedProviderEnv", () => {
  it("keeps the string values of input.providerEnv", () => {
    expect(
      suppliedProviderEnv({
        input: { providerEnv: { A: "1", B: 2, C: "" } },
      }),
    ).toEqual({ A: "1", C: "" });
  });

  it("is empty without providerEnv", () => {
    expect(suppliedProviderEnv({ input: {} })).toEqual({});
    expect(suppliedProviderEnv({ input: { providerEnv: "x" } })).toEqual({});
  });
});

describe("allProviderPaths", () => {
  it("returns every provider's app paths once, sorted", () => {
    expect(
      allProviderPaths({
        "../../enable/x/providers/google/src/lib/a.svelte": "",
        "../../enable/x/providers/google/src/lib/gtag.ts": "",
        "../../enable/x/providers/plausible/src/lib/a.svelte": "",
      }),
    ).toEqual(["src/lib/a.svelte", "src/lib/gtag.ts"]);
  });
});
