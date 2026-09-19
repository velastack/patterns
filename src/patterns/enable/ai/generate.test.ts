import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Features, Options, RouteGroups } from "../../../core/types";
import { InvalidArgumentError } from "../../../core/errors";
import { demoDir, envEditsFor, generate, PROVIDERS } from "./generate";
import { generate as generatePreview } from "./generate.preview";
import {
  generate as generateRuntime,
  STATIC_ADAPTER_MESSAGE,
  usesStaticAdapter,
} from "./generate.runtime";

function makeOptions(
  input: Record<string, unknown>,
  {
    argv = [],
    env = "runtime",
    root = "/tmp/project",
    features = {},
    routeGroups,
  }: {
    argv?: string[];
    env?: "runtime" | "preview";
    root?: string;
    features?: Partial<Features>;
    routeGroups?: RouteGroups;
  } = {},
): Options {
  return {
    argv,
    env,
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

const AI_PATH = "src/lib/server/ai.ts";
const ENDPOINT_PATH = "src/routes/api/chat/+server.ts";
const ENDPOINT_TEST_PATH = "src/routes/api/chat/server.test.ts";
const PUBLIC_PAGE_PATH = "src/routes/(public)/ai/+page.svelte";

const paths = (files: { path: string }[]) => files.map((f) => f.path);
const content = (files: { path: string; content: string }[], p: string) =>
  files.find((f) => f.path === p)?.content ?? "";

describe("ai providers", () => {
  it("declares gateway, openai and anthropic in prompt order", () => {
    expect(PROVIDERS.map((p) => p.id)).toEqual([
      "gateway",
      "openai",
      "anthropic",
    ]);
  });

  it("only declares private, secret env keys", () => {
    for (const provider of PROVIDERS) {
      expect(provider.env?.length).toBe(1);
      for (const variable of provider.env ?? []) {
        expect(variable.key).not.toMatch(/^PUBLIC_/);
        expect(variable.secret).toBe(true);
        expect(variable.default).toBeUndefined();
      }
    }
  });
});

describe("ai generate", () => {
  it("creates the gateway model, endpoint, tests and demo page", async () => {
    const result = await generate(makeOptions({ provider: "gateway" }));
    expect(paths(result.creates)).toEqual([
      AI_PATH,
      PUBLIC_PAGE_PATH,
      ENDPOINT_PATH,
      ENDPOINT_TEST_PATH,
    ]);
    const ai = content(result.creates, AI_PATH);
    expect(ai).toContain("createGateway({ apiKey })");
    expect(ai).toContain("'AI_GATEWAY_API_KEY'");
    expect(ai).toContain("$env/dynamic/private");
    expect(result.packages).toEqual([
      "ai@^7.0.107",
      "@ai-sdk/svelte@^5.0.107",
      "zod@^4.1.11",
    ]);
    expect(result.components).toEqual(["button", "textarea"]);
  });

  it("installs @ai-sdk/openai for OpenAI", async () => {
    const result = await generate(makeOptions({ provider: "openai" }));
    const ai = content(result.creates, AI_PATH);
    expect(ai).toContain("from '@ai-sdk/openai'");
    expect(ai).toContain("'OPENAI_API_KEY'");
    expect(result.packages).toContain("@ai-sdk/openai@^4.0.71");
  });

  it("installs @ai-sdk/anthropic for Anthropic", async () => {
    const result = await generate(makeOptions({ provider: "anthropic" }));
    const ai = content(result.creates, AI_PATH);
    expect(ai).toContain("from '@ai-sdk/anthropic'");
    expect(ai).toContain("'ANTHROPIC_API_KEY'");
    expect(result.packages).toContain("@ai-sdk/anthropic@^4.0.58");
  });

  it("streams through the provider-agnostic model from the endpoint", async () => {
    const result = await generate(makeOptions({ provider: "openai" }));
    const endpoint = content(result.creates, ENDPOINT_PATH);
    expect(endpoint).toContain("from '$lib/server/ai'");
    expect(endpoint).toContain("safeValidateUIMessages");
    expect(endpoint).toContain("instructions: INSTRUCTIONS");
    expect(endpoint).toContain("createUIMessageStreamResponse");
    expect(endpoint).toContain("{ status: 503 }");
    expect(endpoint).not.toContain("authStore");
  });

  it("answers only signed-in users and puts the page in (app) with auth", async () => {
    const result = await generate(
      makeOptions({ provider: "gateway" }, { features: { auth: true } }),
    );
    expect(paths(result.creates)).toContain("src/routes/(app)/ai/+page.svelte");
    expect(paths(result.creates)).not.toContain(PUBLIC_PAGE_PATH);
    const endpoint = content(result.creates, ENDPOINT_PATH);
    expect(endpoint).toContain("locals.pb.authStore.isValid");
    expect(endpoint).toContain("{ status: 401 }");
    expect(content(result.creates, ENDPOINT_TEST_PATH)).toContain(
      "should return 401 when signed out",
    );
  });

  it("puts the page straight under src/routes in a project without groups", async () => {
    const result = await generate(
      makeOptions(
        { provider: "gateway", serverTests: false },
        {
          features: { backend: false, ui: "plain" },
          routeGroups: { public: null, app: null },
        },
      ),
    );
    expect(paths(result.creates)).toEqual([
      AI_PATH,
      "src/routes/ai/+page.svelte",
      ENDPOINT_PATH,
    ]);
  });

  it("uses native elements and no components for a plain project", async () => {
    const result = await generate(
      makeOptions({ provider: "gateway" }, { features: { ui: "plain" } }),
    );
    const page = content(result.creates, PUBLIC_PAGE_PATH);
    expect(page).toContain("new Chat({})");
    expect(page).toContain("<textarea");
    expect(page).not.toContain("$lib/components/ui");
    expect(result.components).toEqual([]);
  });

  it("renders the shadcn page by default", async () => {
    const result = await generate(makeOptions({ provider: "gateway" }));
    const page = content(result.creates, PUBLIC_PAGE_PATH);
    expect(page).toContain("new Chat({})");
    expect(page).toContain("$lib/components/ui/textarea");
    expect(page).toContain("chat.stop()");
    expect(page).toContain("chat.regenerate()");
  });

  it("leaves out the server tests without the test harness", async () => {
    const result = await generate(
      makeOptions({ provider: "gateway", serverTests: false }),
    );
    expect(paths(result.creates)).not.toContain(ENDPOINT_TEST_PATH);
  });

  it("reads --provider from argv when input has none", async () => {
    const result = await generate(
      makeOptions({}, { argv: ["--provider", "anthropic"] }),
    );
    expect(result.packages).toContain("@ai-sdk/anthropic@^4.0.58");
  });

  it("rejects an unknown provider", async () => {
    await expect(generate(makeOptions({ provider: "foo" }))).rejects.toThrow(
      'Unknown provider "foo" for ai.',
    );
  });

  it("rejects a missing provider at runtime", async () => {
    await expect(generate(makeOptions({}))).rejects.toThrow(
      InvalidArgumentError,
    );
  });

  it("defaults to the gateway in preview", async () => {
    const result = await generate(makeOptions({}, { env: "preview" }));
    expect(content(result.creates, AI_PATH)).toContain("createGateway");
  });
});

describe("demoDir", () => {
  it("follows the default route group", () => {
    expect(demoDir(makeOptions({}))).toBe("src/routes/(public)/ai");
    expect(demoDir(makeOptions({}, { features: { auth: true } }))).toBe(
      "src/routes/(app)/ai",
    );
    expect(
      demoDir(makeOptions({}, { routeGroups: { public: null, app: null } })),
    ).toBe("src/routes/ai");
  });
});

describe("ai preview", () => {
  it("lists the provider's env key", async () => {
    const result = await generatePreview(
      makeOptions({ provider: "anthropic" }, { env: "preview" }),
    );
    expect(result.modifies).toEqual([
      {
        path: ".env",
        language: "text",
        content: "# AI SDK (Anthropic)\nANTHROPIC_API_KEY=\n",
        status: "success",
      },
    ]);
  });
});

describe("envEditsFor", () => {
  const openai = PROVIDERS.find((p) => p.id === "openai")!;

  it("writes the supplied key, trimmed", () => {
    expect(envEditsFor(openai, { OPENAI_API_KEY: " sk-123 " })).toEqual([
      { type: "comment", key: "AI SDK (OpenAI)" },
      { type: "var", key: "OPENAI_API_KEY", value: "sk-123" },
    ]);
  });

  it("writes a blank assignment, never the placeholder", () => {
    expect(envEditsFor(openai)).toEqual([
      { type: "comment", key: "AI SDK (OpenAI)" },
      { type: "var", key: "OPENAI_API_KEY", value: "" },
    ]);
  });
});

describe("ai runtime", () => {
  let root: string;

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  function project(viteConfig: string, env?: string): string {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "enable-ai-"));
    fs.writeFileSync(path.join(root, "vite.config.ts"), viteConfig);
    if (env !== undefined) fs.writeFileSync(path.join(root, ".env"), env);
    return root;
  }

  const viteConfig = (adapter: string) =>
    [
      "import { defineConfig } from 'vite';",
      "import { sveltekit } from '@sveltejs/kit/vite';",
      `import adapter from '${adapter}';`,
      "",
      "export default defineConfig({ plugins: [sveltekit({ adapter: adapter() })] });",
      "",
    ].join("\n");

  it("refuses a project built with adapter-static", async () => {
    project(viteConfig("@sveltejs/adapter-static"));
    expect(usesStaticAdapter(root)).toBe(true);
    await expect(
      generateRuntime(makeOptions({ provider: "gateway" }, { root })),
    ).rejects.toThrow(STATIC_ADAPTER_MESSAGE);
  });

  it("appends the key to .env on a server adapter", async () => {
    project(viteConfig("@sveltejs/adapter-node"), "POCKETBASE_URL=x\n");
    expect(usesStaticAdapter(root)).toBe(false);
    const result = await generateRuntime(
      makeOptions(
        { provider: "openai", providerEnv: { OPENAI_API_KEY: "sk-live" } },
        { root },
      ),
    );
    expect(result.modifies.map((f) => path.basename(f.path))).toEqual([".env"]);
    expect(fs.readFileSync(path.join(root, ".env"), "utf8")).toBe(
      "POCKETBASE_URL=x\n# AI SDK (OpenAI)\nOPENAI_API_KEY=sk-live\n",
    );
  });

  it("keeps a key .env already has", async () => {
    project(viteConfig("@sveltejs/adapter-auto"), "OPENAI_API_KEY=sk-old\n");
    await generateRuntime(
      makeOptions(
        { provider: "openai", providerEnv: { OPENAI_API_KEY: "sk-new" } },
        { root },
      ),
    );
    const env = fs.readFileSync(path.join(root, ".env"), "utf8");
    expect(env).toContain("OPENAI_API_KEY=sk-old\n");
    expect(env).not.toContain("sk-new");
  });
});
