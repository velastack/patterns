import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

import { modifyViteConfigMdsvex } from "./vite-config";
import { SVELTE_CONFIG_MESSAGE } from "../../../../runtime/config-target";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(__dirname, "fixtures");
const tempDir = path.join(__dirname, "temp");

describe("enable blog modifiers", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("adds the mdsvex plugin ahead of sveltekit()", async () => {
    const { filePath, outcome } = modifyViteConfigMdsvex(tempDir);

    expect(outcome).toEqual({ status: "success", changed: true });
    await expect(fs.readFileSync(filePath, "utf8")).toMatchFormatted(
      fs.readFileSync(
        path.join(fixturesPath, "expect", "vite.config.ts"),
        "utf8",
      ),
      "vite.config.ts",
    );
  });

  it("is idempotent", () => {
    const { filePath } = modifyViteConfigMdsvex(tempDir);
    const first = fs.readFileSync(filePath, "utf8");

    expect(modifyViteConfigMdsvex(tempDir).outcome).toEqual({
      status: "success",
      changed: false,
    });
    expect(fs.readFileSync(filePath, "utf8")).toBe(first);
  });

  it("joins the extensions already there and leaves preprocessors alone", () => {
    const filePath = path.join(tempDir, "vite.config.ts");
    fs.writeFileSync(
      filePath,
      [
        `import { defineConfig } from 'vite';`,
        `import { sveltekit } from '@sveltejs/kit/vite';`,
        `import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';`,
        ``,
        `export default defineConfig({`,
        `\tplugins: [sveltekit({ extensions: ['.svelte'], preprocess: vitePreprocess() })]`,
        `});`,
        ``,
      ].join("\n"),
    );

    expect(modifyViteConfigMdsvex(tempDir).outcome.status).toBe("success");
    const modified = fs.readFileSync(filePath, "utf8");
    expect(modified).toContain(`extensions: ['.svelte', '.svx']`);
    expect(modified).toContain(`preprocess: vitePreprocess()`);
    expect(modified).toMatch(
      /plugins: \[mdsvex\(\{ smart_punctuation: true \}\),\s*sveltekit\(/,
    );
    expect(modified).toContain(`import { mdsvex } from 'mdsvex';`);
  });

  it.each([
    ["mdsvex 0.x under preprocess", "[sveltekit({ preprocess: [mdsvex()] })]"],
    ["a plugin list it can't edit", "withPlugins(sveltekit({}))"],
  ])("refuses %s", (_, plugins) => {
    const filePath = path.join(tempDir, "vite.config.ts");
    const before = [
      `import { defineConfig } from 'vite';`,
      `import { mdsvex } from 'mdsvex';`,
      `import { sveltekit } from '@sveltejs/kit/vite';`,
      ``,
      `export default defineConfig({ plugins: ${plugins} });`,
      ``,
    ].join("\n");
    fs.writeFileSync(filePath, before);

    const { outcome } = modifyViteConfigMdsvex(tempDir);
    expect(outcome.status).toBe("failed");
    expect((outcome as { message: string }).message).toContain(
      "npx @mdsvex/migrate",
    );
    expect(fs.readFileSync(filePath, "utf8")).toBe(before);
  });

  it("refuses a svelte.config.js (SvelteKit 2) with the migrate message", () => {
    fs.writeFileSync(
      path.join(tempDir, "svelte.config.js"),
      "export default { kit: {} };\n",
    );
    const before = fs.readFileSync(
      path.join(tempDir, "vite.config.ts"),
      "utf8",
    );

    expect(modifyViteConfigMdsvex(tempDir).outcome).toEqual({
      status: "failed",
      message: SVELTE_CONFIG_MESSAGE,
    });
    expect(fs.readFileSync(path.join(tempDir, "vite.config.ts"), "utf8")).toBe(
      before,
    );
  });
});
