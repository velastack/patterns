import { describe, expect, it } from "vitest";
import { InvalidArgumentError } from "./errors";
import {
  capabilityName,
  providerCreates,
  providerFromArgv,
  resolveProvider,
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
