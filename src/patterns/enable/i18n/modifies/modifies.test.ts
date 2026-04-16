import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

import { modifyViteConfig } from "./vite-config";
import { modifySvelteConfig } from "./svelte-config";
import { modifyHooksServerI18n } from "./hooks.server";
import { modifyAppHtml } from "./app-html";
import { modifyGitignore } from "./gitignore";
import { ensureRootLayoutI18n } from "./+layout";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesPath = path.join(__dirname, "fixtures");
const tempDir = path.join(__dirname, "temp");

describe("enable i18n modifiers", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("modifies vite.config.ts", async () => {
    const filePath = path.join(tempDir, "vite.config.ts");
    modifyViteConfig(filePath);

    const modified = fs.readFileSync(filePath, "utf8");
    const expected = fs.readFileSync(
      path.join(fixturesPath, "expect", "vite.config.ts"),
      "utf8",
    );
    await expect(modified).toMatchFormatted(expected, "vite.config.ts");
  });

  it("modifies svelte.config.js", async () => {
    const filePath = path.join(tempDir, "svelte.config.js");
    modifySvelteConfig(filePath);

    const modified = fs.readFileSync(filePath, "utf8");
    const expected = fs.readFileSync(
      path.join(fixturesPath, "expect", "svelte.config.js"),
      "utf8",
    );
    await expect(modified).toMatchFormatted(expected, "svelte.config.js");
  });

  it("modifies hooks.server.ts", async () => {
    const filePath = path.join(tempDir, "hooks.server.ts");
    modifyHooksServerI18n(filePath);

    const modified = fs.readFileSync(filePath, "utf8");
    const expected = fs.readFileSync(
      path.join(fixturesPath, "expect", "hooks.server.ts"),
      "utf8",
    );
    await expect(modified).toMatchFormatted(expected, "hooks.server.ts");
  });

  it("modifies app.html", async () => {
    const filePath = path.join(tempDir, "app.html");
    modifyAppHtml(filePath);

    const modified = fs.readFileSync(filePath, "utf8");
    const expected = fs.readFileSync(
      path.join(fixturesPath, "expect", "app.html"),
      "utf8",
    );
    await expect(modified).toMatchFormatted(expected, "app.html");
  });

  it("modifies .gitignore", async () => {
    const filePath = path.join(tempDir, ".gitignore");
    modifyGitignore(filePath);

    const modified = fs.readFileSync(filePath, "utf8");
    const expected = fs.readFileSync(
      path.join(fixturesPath, "expect", ".gitignore"),
      "utf8",
    );
    await expect(modified).toMatchFormatted(expected, ".gitignore");
  });

  it("creates src/routes/+layout.ts when missing", async () => {
    const layoutPath = path.join(tempDir, "src", "routes", "+layout.ts");
    expect(fs.existsSync(layoutPath)).toBe(false);

    ensureRootLayoutI18n(layoutPath);

    const modified = fs.readFileSync(layoutPath, "utf8");
    const expected = fs.readFileSync(
      path.join(fixturesPath, "expect", "src", "routes", "+layout.ts"),
      "utf8",
    );
    await expect(modified).toMatchFormatted(expected, "+layout.ts");
  });

  it("is idempotent for repeated modifications", () => {
    const hooksPath = path.join(tempDir, "hooks.server.ts");
    const vitePath = path.join(tempDir, "vite.config.ts");

    modifyHooksServerI18n(hooksPath);
    modifyViteConfig(vitePath);
    const firstHooks = fs.readFileSync(hooksPath, "utf8");
    const firstVite = fs.readFileSync(vitePath, "utf8");

    modifyHooksServerI18n(hooksPath);
    modifyViteConfig(vitePath);
    const secondHooks = fs.readFileSync(hooksPath, "utf8");
    const secondVite = fs.readFileSync(vitePath, "utf8");

    expect(secondHooks).toBe(firstHooks);
    expect(secondVite).toBe(firstVite);
  });

  it("does not modify hooks.server.ts when there is no exported handle", () => {
    const filePath = path.join(tempDir, "hooks.server.no-handle.ts");
    const original = fs.readFileSync(filePath, "utf8");

    const changed = modifyHooksServerI18n(filePath);
    const modified = fs.readFileSync(filePath, "utf8");

    expect(changed).toBe(false);
    expect(modified).toBe(original);
  });

  it("does not modify app.html that already has lang placeholder", () => {
    const filePath = path.join(tempDir, "app-already.html");
    const original = fs.readFileSync(filePath, "utf8");

    const changed = modifyAppHtml(filePath);
    const modified = fs.readFileSync(filePath, "utf8");

    expect(changed).toBe(false);
    expect(modified).toBe(original);
  });

  it("does not replace an existing load export in +layout.ts", () => {
    const layoutPath = path.join(tempDir, "src", "routes", "+layout.ts");
    fs.mkdirSync(path.dirname(layoutPath), { recursive: true });
    fs.writeFileSync(
      layoutPath,
      `export const load = async ({ data }) => ({ ...data, ok: true });\n`,
    );

    const original = fs.readFileSync(layoutPath, "utf8");
    const changed = ensureRootLayoutI18n(layoutPath);
    const modified = fs.readFileSync(layoutPath, "utf8");

    expect(changed).toBe(false);
    expect(modified).toBe(original);
  });

  it("adds only the import for non-array vite plugins", () => {
    const filePath = path.join(tempDir, "vite.non-array.config.ts");
    fs.writeFileSync(
      filePath,
      [
        `import { defineConfig } from "vite";`,
        `import { sveltekit } from "@sveltejs/kit/vite";`,
        ``,
        `const plugins = [sveltekit()];`,
        ``,
        `export default defineConfig({`,
        `  plugins: pluginsFactory(plugins),`,
        `});`,
        ``,
      ].join("\n"),
    );

    const changed = modifyViteConfig(filePath);
    const modified = fs.readFileSync(filePath, "utf8");

    expect(changed).toBe(true);
    expect(modified).toContain(`import { wuchale } from 'wuchale/vite';`);
    expect(modified).not.toContain("wuchale()");
  });
});
