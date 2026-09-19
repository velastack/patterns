import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Features, Options, RouteGroups } from "../../../core/types";
import { generate as enable, PROVIDERS } from "../../enable/ai/generate";
import { aiPaths, demoDirs, generate } from "./generate";
import { generate as generateRuntime } from "./generate.runtime";

function makeOptions(
  input: Record<string, unknown> = {},
  {
    root = "/tmp/project",
    features = {},
    routeGroups,
  }: {
    root?: string;
    features?: Partial<Features>;
    routeGroups?: RouteGroups;
  } = {},
): Options {
  return {
    argv: [],
    env: "runtime",
    root,
    features: {
      auth: false,
      api: false,
      apiKeys: false,
      backend: true,
      i18n: false,
      teams: false,
      payments: false,
      blog: false,
      contentNegotiation: false,
      cms: false,
      ...features,
    },
    routeGroups,
    input,
  };
}

const NO_GROUPS: RouteGroups = { public: null, app: null };

describe("disable ai generate", () => {
  it("deletes the model module, endpoint, its test and the public demo page", async () => {
    const result = await generate(makeOptions());
    expect(result.deletes.map((f) => f.path)).toEqual([
      "src/lib/server/ai.ts",
      "src/routes/(public)/ai/+page.svelte",
      "src/routes/api/chat/+server.ts",
      "src/routes/api/chat/server.test.ts",
    ]);
  });

  it("looks for the demo page in (app) with auth, and at the root without groups", () => {
    expect(aiPaths(makeOptions({}, { features: { auth: true } }))).toContain(
      "src/routes/(app)/ai/+page.svelte",
    );
    expect(aiPaths(makeOptions({}, { routeGroups: NO_GROUPS }))).toContain(
      "src/routes/ai/+page.svelte",
    );
  });

  it("uninstalls every AI SDK package enable-ai may have added, but not zod", async () => {
    const result = await generate(makeOptions());
    expect(result.uninstalls).toEqual([
      "ai@^7.0.107",
      "@ai-sdk/svelte@^5.0.107",
      "@ai-sdk/openai@^4.0.71",
      "@ai-sdk/anthropic@^4.0.58",
    ]);
  });

  // The drift guard: whatever enable-ai writes, disable-ai must remove.
  it.each(
    PROVIDERS.flatMap((provider) =>
      [false, true].flatMap((auth) =>
        (["shadcn", "plain"] as const).flatMap((ui) =>
          [undefined, NO_GROUPS].map(
            (routeGroups) => [provider.id, auth, ui, routeGroups] as const,
          ),
        ),
      ),
    ),
  )(
    "removes everything enable-ai creates (%s, auth %s, %s, %o)",
    async (provider, auth, ui, routeGroups) => {
      const options = makeOptions(
        { provider },
        { features: { auth, ui }, routeGroups },
      );
      const created = (await enable(options)).creates.map((f) => f.path);
      const deleted = (await generate(options)).deletes.map((f) => f.path);
      expect(deleted).toEqual(expect.arrayContaining(created));
    },
  );
});

describe("demoDirs", () => {
  it("names both groups the page can be in", () => {
    expect(demoDirs(makeOptions())).toEqual([
      "src/routes/(public)/ai",
      "src/routes/(app)/ai",
    ]);
    expect(demoDirs(makeOptions({}, { routeGroups: NO_GROUPS }))).toEqual([
      "src/routes/ai",
    ]);
  });
});

describe("disable ai runtime", () => {
  let root: string;

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  function project(files: Record<string, string>): string {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "disable-ai-"));
    for (const [rel, content] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), content);
    }
    return root;
  }

  it("also deletes a demo page left in (public) from before auth", async () => {
    project({ "src/routes/(public)/ai/+page.svelte": "<p>demo</p>\n" });
    const result = await generateRuntime(
      makeOptions({}, { root, features: { auth: true } }),
    );
    expect(result.deletes.map((f) => f.path)).toEqual([
      "src/routes/(public)/ai/+page.svelte",
    ]);
  });

  it("adds nothing when the page is only where the base result looks", async () => {
    project({ "src/routes/(public)/ai/+page.svelte": "<p>demo</p>\n" });
    const result = await generateRuntime(makeOptions({}, { root }));
    expect(result.deletes).toEqual([]);
  });

  it("deletes a .env the strip leaves empty", async () => {
    project({ ".env": "# AI SDK (OpenAI)\nOPENAI_API_KEY=sk-123\n" });
    const result = await generateRuntime(makeOptions({}, { root }));
    expect(result.deletes.map((f) => path.basename(f.path))).toEqual([".env"]);
    expect(result.modifies).toEqual([]);
  });

  it("strips the provider's key and heading from .env, keeping the rest", async () => {
    project({
      ".env": [
        "POCKETBASE_URL=http://localhost:8090",
        "# AI SDK (Anthropic)",
        "ANTHROPIC_API_KEY=sk-ant-123",
        "",
      ].join("\n"),
    });
    await generateRuntime(makeOptions({}, { root }));
    expect(fs.readFileSync(path.join(root, ".env"), "utf8")).toBe(
      "POCKETBASE_URL=http://localhost:8090\n",
    );
  });
});
