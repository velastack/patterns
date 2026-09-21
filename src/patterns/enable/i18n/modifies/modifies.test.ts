import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

import { modifyViteConfig } from "./vite-config";
import { modifySvelteConfig } from "./svelte-config";
import { modifyHooksServerI18n } from "./hooks.server";
import { modifyHooksI18n } from "./hooks";
import { modifyAppHtml } from "./app-html";
import { modifyGitignore } from "./gitignore";
import { ensureRootLayoutI18n } from "./+layout";
import { modifyRootLayoutLanguageSelect } from "./root-layout.svelte";

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

  it("modifies svelte.config.js (legacy: present alongside a bare sveltekit())", async () => {
    // The fixture has both a svelte.config.js and a vite.config.ts whose
    // sveltekit() has no inline arg, so the resolver targets svelte.config.
    modifySvelteConfig(tempDir);

    const modified = fs.readFileSync(
      path.join(tempDir, "svelte.config.js"),
      "utf8",
    );
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

  it("adds <LanguageSelect /> to root-layout.svelte", async () => {
    const filePath = path.join(tempDir, "root-layout.svelte");
    modifyRootLayoutLanguageSelect(filePath);

    const modified = fs.readFileSync(filePath, "utf8");
    const expected = fs.readFileSync(
      path.join(fixturesPath, "expect", "root-layout.svelte"),
      "utf8",
    );
    await expect(modified).toMatchFormatted(expected, "root-layout.svelte");
  });

  it("is idempotent for root-layout.svelte", () => {
    const filePath = path.join(tempDir, "root-layout.svelte");

    modifyRootLayoutLanguageSelect(filePath);
    const first = fs.readFileSync(filePath, "utf8");

    modifyRootLayoutLanguageSelect(filePath);
    const second = fs.readFileSync(filePath, "utf8");

    expect(second).toBe(first);
  });

  it("adds <LanguageSelect /> above the children of a plain layout", async () => {
    const filePath = path.join(tempDir, "bare-layout.svelte");
    const outcome = modifyRootLayoutLanguageSelect(filePath, "plain");

    expect(outcome).toEqual({ status: "success", changed: true });
    const expected = fs.readFileSync(
      path.join(fixturesPath, "expect", "bare-layout.svelte"),
      "utf8",
    );
    await expect(fs.readFileSync(filePath, "utf8")).toMatchFormatted(
      expected,
      "bare-layout.svelte",
    );
  });

  it("is idempotent for a plain layout", () => {
    const filePath = path.join(tempDir, "bare-layout.svelte");

    modifyRootLayoutLanguageSelect(filePath, "plain");
    const first = fs.readFileSync(filePath, "utf8");

    const outcome = modifyRootLayoutLanguageSelect(filePath, "plain");
    expect(outcome).toEqual({ status: "success", changed: false });
    expect(fs.readFileSync(filePath, "utf8")).toBe(first);
  });

  it("reports failure for a plain layout that never renders its children", () => {
    const filePath = path.join(tempDir, "bare-layout.svelte");
    const original = fs
      .readFileSync(filePath, "utf8")
      .replace("{@render children()}", "<main></main>");
    fs.writeFileSync(filePath, original);

    const outcome = modifyRootLayoutLanguageSelect(filePath, "plain");

    expect(outcome.status).toBe("failed");
    if (outcome.status === "failed") {
      expect(outcome.message).toContain("<LanguageSelect />");
      expect(outcome.message).not.toContain("Navbar");
    }
    expect(fs.readFileSync(filePath, "utf8")).toBe(original);
  });

  it("reports failure for a plain layout without a <script>", () => {
    const filePath = path.join(tempDir, "bare-layout.svelte");
    const original = "{@render children()}\n";
    fs.writeFileSync(filePath, original);

    const outcome = modifyRootLayoutLanguageSelect(filePath, "plain");

    expect(outcome.status).toBe("failed");
    expect(fs.readFileSync(filePath, "utf8")).toBe(original);
  });

  it("points a plain project without a layout at the plain markup", () => {
    const outcome = modifyRootLayoutLanguageSelect(
      path.join(tempDir, "missing.svelte"),
      "plain",
    );

    expect(outcome.status).toBe("not-found");
    if (outcome.status === "not-found") {
      expect(outcome.message).toContain("<LanguageSelect />");
      expect(outcome.message).not.toContain("Navbar");
    }
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

  it("creates src/hooks.ts when missing", async () => {
    const hooksPath = path.join(tempDir, "src", "hooks.ts");
    expect(fs.existsSync(hooksPath)).toBe(false);

    const outcome = modifyHooksI18n(hooksPath);

    expect(outcome).toEqual({ status: "success", changed: true });
    await expect(fs.readFileSync(hooksPath, "utf8")).toMatchFormatted(
      fs.readFileSync(
        path.join(fixturesPath, "expect", "src", "hooks.ts"),
        "utf8",
      ),
      "hooks.ts",
    );
  });

  it("composes with the reroute content negotiation wrote", async () => {
    const filePath = path.join(tempDir, "hooks.negotiate.ts");

    const outcome = modifyHooksI18n(filePath);

    expect(outcome).toEqual({ status: "success", changed: true });
    await expect(fs.readFileSync(filePath, "utf8")).toMatchFormatted(
      fs.readFileSync(
        path.join(fixturesPath, "expect", "hooks.negotiate.ts"),
        "utf8",
      ),
      "hooks.ts",
    );
  });

  it("is idempotent after composing with content negotiation", () => {
    const filePath = path.join(tempDir, "hooks.negotiate.ts");

    modifyHooksI18n(filePath);
    const first = fs.readFileSync(filePath, "utf8");

    const outcome = modifyHooksI18n(filePath);

    expect(outcome).toEqual({ status: "success", changed: false });
    expect(fs.readFileSync(filePath, "utf8")).toBe(first);
  });

  it("refuses to modify an unrecognized reroute", () => {
    const filePath = path.join(tempDir, "hooks.custom.ts");
    const original = fs.readFileSync(filePath, "utf8");

    const outcome = modifyHooksI18n(filePath);

    expect(outcome.status).toBe("failed");
    if (outcome.status === "failed") {
      expect(outcome.message).toContain("rerouteDeLocalize");
    }
    expect(fs.readFileSync(filePath, "utf8")).toBe(original);
  });

  it("creates src/hooks.server.ts when missing", async () => {
    const hooksPath = path.join(tempDir, "src", "hooks.server.ts");
    expect(fs.existsSync(hooksPath)).toBe(false);

    const outcome = modifyHooksServerI18n(hooksPath);

    expect(outcome).toEqual({ status: "success", changed: true });
    const expected = fs.readFileSync(
      path.join(fixturesPath, "expect", "src", "hooks.server.ts"),
      "utf8",
    );
    await expect(fs.readFileSync(hooksPath, "utf8")).toMatchFormatted(
      expected,
      "hooks.server.ts",
    );
  });

  it("does not create hooks.server.ts beside a hooks.server.js", () => {
    const hooksPath = path.join(tempDir, "src", "hooks.server.ts");
    fs.mkdirSync(path.dirname(hooksPath), { recursive: true });
    fs.writeFileSync(hooksPath.replace(/\.ts$/, ".js"), "export {};\n");

    const outcome = modifyHooksServerI18n(hooksPath);

    expect(outcome.status).toBe("failed");
    expect(fs.existsSync(hooksPath)).toBe(false);
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

  it("adds a handle to hooks.server.ts that has none", async () => {
    const filePath = path.join(tempDir, "hooks.server.no-handle.ts");

    const outcome = modifyHooksServerI18n(filePath);

    expect(outcome).toEqual({ status: "success", changed: true });
    await expect(fs.readFileSync(filePath, "utf8")).toMatchFormatted(
      fs.readFileSync(
        path.join(fixturesPath, "expect", "hooks.server.no-handle.ts"),
        "utf8",
      ),
      "hooks.server.ts",
    );
  });

  it("moves a handle written as a function aside to compose it", async () => {
    const filePath = path.join(tempDir, "hooks.server.function.ts");

    modifyHooksServerI18n(filePath);

    await expect(fs.readFileSync(filePath, "utf8")).toMatchFormatted(
      fs.readFileSync(
        path.join(fixturesPath, "expect", "hooks.server.function.ts"),
        "utf8",
      ),
      "hooks.server.ts",
    );
  });

  it("reports failure for a re-exported handle and leaves the file untouched", () => {
    const filePath = path.join(tempDir, "hooks.server.reexport.ts");
    const original = `export { handle } from './other';\n`;
    fs.writeFileSync(filePath, original);

    const outcome = modifyHooksServerI18n(filePath);

    expect(outcome.status).toBe("failed");
    if (outcome.status === "failed") {
      expect(outcome.message).toContain("handleWuchale");
    }
    expect(fs.readFileSync(filePath, "utf8")).toBe(original);
  });

  it("replaces a static lang attribute in app.html with the placeholder", () => {
    const filePath = path.join(tempDir, "app-lang.html");

    const outcome = modifyAppHtml(filePath);
    const modified = fs.readFileSync(filePath, "utf8");

    expect(outcome).toEqual({ status: "success", changed: true });
    expect(modified).toContain('<html lang="%sveltekit.lang%">');
    expect(modified).not.toContain('lang="en"');
  });

  it("does not modify app.html that already has lang placeholder", () => {
    const filePath = path.join(tempDir, "app-already.html");
    const original = fs.readFileSync(filePath, "utf8");

    const outcome = modifyAppHtml(filePath);
    const modified = fs.readFileSync(filePath, "utf8");

    expect(outcome).toEqual({ status: "success", changed: false });
    expect(modified).toBe(original);
  });

  it("adds the loader to a +layout.ts that has no load", async () => {
    const layoutPath = path.join(tempDir, "src", "routes", "+layout.ts");
    fs.mkdirSync(path.dirname(layoutPath), { recursive: true });
    fs.writeFileSync(layoutPath, "export const prerender = true;\n");

    const outcome = ensureRootLayoutI18n(layoutPath);

    expect(outcome).toEqual({ status: "success", changed: true });
    const modified = fs.readFileSync(layoutPath, "utf8");
    // The route options the file already held are still there.
    expect(modified).toContain("export const prerender = true;");
    expect(modified).toContain("await loadLocale(locale);");
  });

  it("joins the loader imports to what +layout.ts imports already", async () => {
    const layoutPath = path.join(tempDir, "src", "routes", "+layout.ts");
    fs.mkdirSync(path.dirname(layoutPath), { recursive: true });
    fs.writeFileSync(
      layoutPath,
      `import { dev } from '$app/environment';\n\nexport const ssr = !dev;\n`,
    );

    ensureRootLayoutI18n(layoutPath);

    const modified = fs.readFileSync(layoutPath, "utf8");
    expect(modified).toContain(
      "import { dev, browser } from '$app/environment';",
    );
    expect(modified).toContain("export const ssr = !dev;");
  });

  it("reports failure when +layout.ts already has a load export", () => {
    const layoutPath = path.join(tempDir, "src", "routes", "+layout.ts");
    fs.mkdirSync(path.dirname(layoutPath), { recursive: true });
    fs.writeFileSync(
      layoutPath,
      `export const load = async ({ data }) => ({ ...data, ok: true });\n`,
    );

    const original = fs.readFileSync(layoutPath, "utf8");
    const outcome = ensureRootLayoutI18n(layoutPath);
    const modified = fs.readFileSync(layoutPath, "utf8");

    expect(outcome.status).toBe("failed");
    if (outcome.status === "failed") {
      expect(outcome.message).toContain("loadLocale");
    }
    expect(modified).toBe(original);
  });

  it("reports failure for non-array vite plugins but still adds the import", () => {
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

    const outcome = modifyViteConfig(filePath);
    const modified = fs.readFileSync(filePath, "utf8");

    expect(outcome.status).toBe("failed");
    expect(modified).toContain(`import { wuchale } from 'wuchale/vite';`);
    expect(modified).not.toContain("wuchale()");
  });

  it("reports not-found when vite config is missing", () => {
    const filePath = path.join(tempDir, "missing.vite.config.ts");
    const outcome = modifyViteConfig(filePath);
    expect(outcome.status).toBe("not-found");
    if (outcome.status === "not-found") {
      expect(outcome.message).toContain("wuchale");
    }
  });
});
