import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Options } from "../../../core/types";
import { generate as enable, PROVIDERS } from "../../enable/analytics/generate";
import { generate } from "./generate";
import { generate as generateRuntime } from "./generate.runtime";

function makeOptions(
  input: Record<string, unknown> = {},
  root = "/tmp/project",
): Options {
  return {
    argv: [],
    env: "runtime",
    root,
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

describe("disable analytics generate", () => {
  it("deletes every provider's files and uninstalls posthog-js", async () => {
    const result = await generate(makeOptions());
    expect(result.deletes.map((f) => f.path)).toEqual([
      "src/lib/components/analytics/analytics.svelte",
      "src/lib/components/analytics/gtag.ts",
    ]);
    expect(result.uninstalls).toEqual(["posthog-js"]);
  });

  it.each(PROVIDERS.map((p) => p.id))(
    "removes everything enable-analytics creates for %s",
    async (provider) => {
      const created = (await enable(makeOptions({ provider }))).creates.map(
        (f) => f.path,
      );
      const deleted = (await generate(makeOptions())).deletes.map(
        (f) => f.path,
      );
      expect(deleted).toEqual(expect.arrayContaining(created));
    },
  );
});

describe("disable analytics runtime", () => {
  let root: string;

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it("strips the provider's variables and heading from .env, keeping the rest", async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "disable-analytics-"));
    fs.writeFileSync(
      path.join(root, ".env"),
      [
        "POCKETBASE_URL=http://localhost:8090",
        "# PostHog analytics",
        "PUBLIC_POSTHOG_KEY=phc_123",
        "PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com",
        "",
      ].join("\n"),
    );
    const result = await generateRuntime(makeOptions({}, root));
    expect(fs.readFileSync(path.join(root, ".env"), "utf8")).toBe(
      "POCKETBASE_URL=http://localhost:8090\n",
    );
    // No root layout in this project: nothing to revert, nothing reported.
    expect(result.modifies.map((f) => path.basename(f.path))).toEqual([".env"]);
    expect(result.deletes).toEqual([]);
  });

  it("deletes a .env the strip leaves empty", async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "disable-analytics-"));
    fs.writeFileSync(
      path.join(root, ".env"),
      "# Plausible analytics\nPUBLIC_PLAUSIBLE_DOMAIN=example.com\n",
    );
    const result = await generateRuntime(makeOptions({}, root));
    expect(result.deletes.map((f) => path.basename(f.path))).toEqual([".env"]);
    expect(result.modifies).toEqual([]);
  });
});
