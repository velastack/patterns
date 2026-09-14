import { describe, expect, it } from "vitest";
import type { Options } from "../../../core/types";
import { InvalidArgumentError } from "../../../core/errors";
import { COMPONENT_PATH, envEditsFor, generate, PROVIDERS } from "./generate";
import { generate as generatePreview } from "./generate.preview";

function makeOptions(
  input: Record<string, unknown>,
  argv: string[] = [],
  env: "runtime" | "preview" = "runtime",
): Options {
  return {
    argv,
    env,
    root: "/tmp/project",
    features: {
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
    },
    input,
  };
}

const GTAG_PATH = "src/lib/components/analytics/gtag.ts";

describe("analytics providers", () => {
  it("declares plausible, google and posthog in prompt order", () => {
    expect(PROVIDERS.map((p) => p.id)).toEqual([
      "plausible",
      "google",
      "posthog",
    ]);
  });

  it("only declares public env keys", () => {
    for (const provider of PROVIDERS) {
      expect(provider.env?.length).toBeGreaterThan(0);
      for (const variable of provider.env ?? []) {
        expect(variable.key).toMatch(/^PUBLIC_/);
      }
    }
  });
});

describe("analytics generate", () => {
  it("creates the Plausible component", async () => {
    const result = await generate(makeOptions({ provider: "plausible" }));
    expect(result.creates.map((f) => f.path)).toEqual([COMPONENT_PATH]);
    const component = result.creates[0].content;
    expect(component).toContain("https://plausible.io/js/script.js");
    expect(component).toContain("data-domain={domain}");
    expect(component).toContain("PUBLIC_PLAUSIBLE_DOMAIN");
    expect(result.packages).toEqual([]);
  });

  it("creates the Google Analytics component and gtag helper", async () => {
    const result = await generate(makeOptions({ provider: "google" }));
    expect(result.creates.map((f) => f.path)).toEqual([
      COMPONENT_PATH,
      GTAG_PATH,
    ]);
    const component = result.creates.find(
      (f) => f.path === COMPONENT_PATH,
    )!.content;
    expect(component).toContain("googletagmanager.com/gtag/js");
    expect(component).toContain("afterNavigate");
    const gtag = result.creates.find((f) => f.path === GTAG_PATH)!.content;
    expect(gtag).toContain("send_page_view: false");
    expect(gtag).toContain("'page_view'");
    expect(result.packages).toEqual([]);
  });

  it("creates the PostHog component and installs posthog-js", async () => {
    const result = await generate(makeOptions({ provider: "posthog" }));
    expect(result.creates.map((f) => f.path)).toEqual([COMPONENT_PATH]);
    const component = result.creates[0].content;
    expect(component).toContain("posthog.init(");
    expect(component).toContain("defaults:");
    expect(component).toContain("PUBLIC_POSTHOG_KEY");
    expect(component).toContain("PUBLIC_POSTHOG_HOST");
    expect(result.packages).toEqual(["posthog-js"]);
  });

  it("reads --provider from argv when input has none", async () => {
    const result = await generate(makeOptions({}, ["--provider", "posthog"]));
    expect(result.packages).toEqual(["posthog-js"]);
  });

  it("rejects an unknown provider", async () => {
    await expect(generate(makeOptions({ provider: "foo" }))).rejects.toThrow(
      InvalidArgumentError,
    );
    await expect(generate(makeOptions({ provider: "foo" }))).rejects.toThrow(
      'Unknown provider "foo" for analytics.',
    );
  });

  it("rejects a missing provider at runtime", async () => {
    await expect(generate(makeOptions({}))).rejects.toThrow(
      InvalidArgumentError,
    );
  });

  it("defaults to Plausible in preview", async () => {
    const result = await generate(makeOptions({}, [], "preview"));
    expect(result.creates[0].content).toContain("plausible.io");
  });
});

describe("analytics preview", () => {
  it("mounts the component in the layout and lists the provider's env keys", async () => {
    const result = await generatePreview(
      makeOptions({ provider: "posthog" }, [], "preview"),
    );
    const layout = result.modifies.find((f) =>
      f.path.endsWith("+layout.svelte"),
    );
    expect(layout?.content).toContain("<Analytics />");
    const env = result.modifies.find((f) => f.path === ".env");
    expect(env?.content).toBe(
      [
        "# PostHog analytics",
        "PUBLIC_POSTHOG_KEY=",
        "PUBLIC_POSTHOG_HOST=https://us.i.posthog.com",
        "",
      ].join("\n"),
    );
  });
});

describe("envEditsFor", () => {
  const posthog = PROVIDERS.find((p) => p.id === "posthog")!;
  const plausible = PROVIDERS.find((p) => p.id === "plausible")!;

  it("writes supplied values", () => {
    expect(
      envEditsFor(posthog, {
        PUBLIC_POSTHOG_KEY: " phc_123 ",
        PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
      }),
    ).toEqual([
      { type: "comment", key: "PostHog analytics" },
      { type: "var", key: "PUBLIC_POSTHOG_KEY", value: "phc_123" },
      {
        type: "var",
        key: "PUBLIC_POSTHOG_HOST",
        value: "https://eu.i.posthog.com",
      },
    ]);
  });

  it("falls back to the declared default, else blank", () => {
    expect(envEditsFor(posthog)).toEqual([
      { type: "comment", key: "PostHog analytics" },
      { type: "var", key: "PUBLIC_POSTHOG_KEY", value: "" },
      {
        type: "var",
        key: "PUBLIC_POSTHOG_HOST",
        value: "https://us.i.posthog.com",
      },
    ]);
    expect(envEditsFor(plausible, { PUBLIC_PLAUSIBLE_DOMAIN: "  " })).toEqual([
      { type: "comment", key: "Plausible analytics" },
      { type: "var", key: "PUBLIC_PLAUSIBLE_DOMAIN", value: "" },
    ]);
  });

  it("never writes the prompt placeholder", () => {
    const edits = envEditsFor(plausible);
    expect(JSON.stringify(edits)).not.toContain("example.com");
  });
});
