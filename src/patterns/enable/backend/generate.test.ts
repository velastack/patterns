import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Options } from "../../../core/types";
import { generate } from "./generate";
import { generate as generatePreview } from "./generate.preview";
import { generate as generateRuntime } from "./generate.runtime";

function makeOptions(root: string, env: Options["env"] = "runtime"): Options {
  return {
    argv: [],
    env,
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
    input: {},
  };
}

const NAMES = [
  "POCKETBASE_URL",
  "POCKETBASE_SUPERUSER_EMAIL",
  "POCKETBASE_SUPERUSER_PASSWORD",
];

describe("enable backend", () => {
  let root: string;

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it("installs the Kit 3 releases of the libraries and adapter-node", async () => {
    const result = await generate(makeOptions("/tmp/project"));
    expect(result.packages).toEqual(
      expect.arrayContaining([
        "@velastack/pocketbase@^0.4.0",
        "@velastack/kit@^0.4.0",
        "@sveltejs/adapter-node@^6.0.0",
      ]),
    );
  });

  it("previews vite.config.ts and the src/env.ts declarations", async () => {
    const result = await generatePreview(
      makeOptions("/tmp/project", "preview"),
    );
    const paths = result.modifies.map((f) => f.path);
    expect(paths).toContain("vite.config.ts");
    expect(paths).not.toContain("svelte.config.js");
    const decl = result.modifies.find((f) => f.path === "src/env.ts");
    for (const name of NAMES) expect(decl?.content).toContain(`${name}: {`);
  });

  it("creates src/env.ts declaring the PocketBase variables when there is none", async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "enable-backend-"));
    fs.writeFileSync(
      path.join(root, "vite.config.ts"),
      [
        "import { defineConfig } from 'vite';",
        "import { sveltekit } from '@sveltejs/kit/vite';",
        "import adapter from '@sveltejs/adapter-static';",
        "",
        "export default defineConfig({ plugins: [sveltekit({ adapter: adapter() })] });",
        "",
      ].join("\n"),
    );
    const result = await generateRuntime(makeOptions(root));
    const decl = result.creates.find(
      (f) => f.path === path.join(root, "src", "env.ts"),
    );
    for (const name of NAMES) expect(decl?.content).toContain(`${name}: {`);
    expect(decl?.content).not.toContain("WORKFLOWS_");
  });
});
