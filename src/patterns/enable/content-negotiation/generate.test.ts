import { describe, expect, it } from "vitest";
import type { Options } from "../../../core/types";
import { generate } from "./generate";
import { generate as generateDisable } from "../../disable/content-negotiation/generate";

const features = {
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
};

const options = (extra: Partial<Options> = {}): Options => ({
  argv: [],
  env: "preview",
  root: "",
  features,
  input: {},
  ...extra,
});

const paths = (files: { path: string }[]) => files.map((f) => f.path);

describe("enable-content-negotiation", () => {
  it("writes the demo page into (public) by default", async () => {
    const result = await generate(options());
    expect(paths(result.creates)).toEqual([
      "src/lib/negotiate.ts",
      "src/routes/(public)/negotiate/+page.server.ts",
      "src/routes/(public)/negotiate/+page.svelte",
      "src/routes/(public)/negotiate/+page.ts",
    ]);
  });

  it("goes straight under src/routes in a project without groups", async () => {
    const bare = options({
      routeGroups: { public: null, app: null },
      input: { metaTags: false },
    });
    // No svelte-meta-tags, so no loader importing it.
    expect(paths((await generate(bare)).creates)).toEqual([
      "src/lib/negotiate.ts",
      "src/routes/negotiate/+page.server.ts",
      "src/routes/negotiate/+page.svelte",
    ]);
    // Disabling deletes from where enabling wrote.
    expect(paths((await generateDisable(bare)).deletes)).toContain(
      "src/routes/negotiate/+page.svelte",
    );
  });
});
