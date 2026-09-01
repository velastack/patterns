import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

import { modifyViteConfig } from "./vite-config";
import { modifyLayoutServer, WUCHALE_LOCALE } from "./layout.server";
import { modifyLayoutSvelte } from "./layout.svelte";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesPath = path.join(__dirname, "fixtures");
const tempDir = path.join(__dirname, "temp");

const LAYOUT_SERVER = path.join("src", "routes", "+layout.server.ts");
const LAYOUT_SVELTE = path.join("src", "routes", "+layout.svelte");

function read(rel: string): string {
  return fs.readFileSync(path.join(tempDir, rel), "utf8");
}

function expected(rel: string): string {
  return fs.readFileSync(path.join(fixturesPath, "expect", rel), "utf8");
}

function writeLayoutServer(name: string, source: string): string {
  const filePath = path.join(tempDir, "src", "routes", name);
  fs.writeFileSync(filePath, source);
  return filePath;
}

describe("enable cms modifiers", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // --- vite.config.ts ---

  it("registers cms() ahead of sveltekit() in vite.config.ts", async () => {
    const filePath = path.join(tempDir, "vite.config.ts");
    const outcome = modifyViteConfig(filePath);

    expect(outcome).toEqual({ status: "success", changed: true });
    await expect(read("vite.config.ts")).toMatchFormatted(
      expected("vite.config.ts"),
      "vite.config.ts",
    );
  });

  it("is idempotent for vite.config.ts", () => {
    const filePath = path.join(tempDir, "vite.config.ts");

    modifyViteConfig(filePath);
    const first = read("vite.config.ts");

    const outcome = modifyViteConfig(filePath);
    const second = read("vite.config.ts");

    expect(outcome).toEqual({ status: "success", changed: false });
    expect(second).toBe(first);
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
    expect(modified).toContain(`import { cms } from '@velastack/cms/vite';`);
    expect(modified).not.toContain("cms()");
  });

  it("reports not-found when vite config is missing", () => {
    const outcome = modifyViteConfig(
      path.join(tempDir, "missing.vite.config.ts"),
    );
    expect(outcome.status).toBe("not-found");
    if (outcome.status === "not-found") {
      expect(outcome.message).toContain("cms()");
    }
  });

  // --- src/routes/+layout.server.ts ---

  it("wires loadCms into a wrapped, destructuring load", async () => {
    const filePath = path.join(tempDir, LAYOUT_SERVER);
    const outcome = modifyLayoutServer(filePath);

    expect(outcome).toEqual({ status: "success", changed: true });
    await expect(read(LAYOUT_SERVER)).toMatchFormatted(
      expected(LAYOUT_SERVER),
      "+layout.server.ts",
    );
  });

  it("is idempotent for +layout.server.ts", () => {
    const filePath = path.join(tempDir, LAYOUT_SERVER);

    modifyLayoutServer(filePath);
    const first = read(LAYOUT_SERVER);

    const outcome = modifyLayoutServer(filePath);
    const second = read(LAYOUT_SERVER);

    expect(outcome).toEqual({ status: "success", changed: false });
    expect(second).toBe(first);
  });

  it("passes the wuchale locale when asked", () => {
    const filePath = path.join(tempDir, LAYOUT_SERVER);
    const outcome = modifyLayoutServer(filePath, WUCHALE_LOCALE);
    const modified = read(LAYOUT_SERVER);

    expect(outcome).toEqual({ status: "success", changed: true });
    expect(modified).toContain(
      "import { getLocale } from '$locales/main.url';",
    );
    expect(modified).toContain(
      "await loadCms(event, { locale: getLocale(event.url) })",
    );
  });

  it("keeps an identifier parameter as the event", () => {
    const filePath = writeLayoutServer(
      "+layout.server.ident.ts",
      [
        `export const load = async (e) => {`,
        `  return { ok: true };`,
        `};`,
        ``,
      ].join("\n"),
    );

    const outcome = modifyLayoutServer(filePath);
    const modified = fs.readFileSync(filePath, "utf8");

    expect(outcome).toEqual({ status: "success", changed: true });
    expect(modified).toContain("await loadCms(e, { locale: 'en' })");
    expect(modified).not.toContain("= e;");
    expect(modified).toMatch(/return \{\s*ok: true,\s*cms\s*\};/);
  });

  it("keeps the parameter's type annotation when it moves to the body", () => {
    const filePath = writeLayoutServer(
      "+layout.server.typed.ts",
      [
        `import type { LayoutServerLoadEvent } from './$types';`,
        ``,
        `export const load = async ({ locals }: LayoutServerLoadEvent) => {`,
        `  return { meta: locals.meta };`,
        `};`,
        ``,
      ].join("\n"),
    );

    const outcome = modifyLayoutServer(filePath);
    const modified = fs.readFileSync(filePath, "utf8");

    expect(outcome).toEqual({ status: "success", changed: true });
    expect(modified).toContain("async (event: LayoutServerLoadEvent) =>");
    expect(modified).toContain("const { locals } = event;");
  });

  it("adds an event parameter to a load that had none", () => {
    const filePath = writeLayoutServer(
      "+layout.server.noparam.ts",
      [`export function load() {`, `  return {};`, `}`, ``].join("\n"),
    );

    const outcome = modifyLayoutServer(filePath);
    const modified = fs.readFileSync(filePath, "utf8");

    expect(outcome).toEqual({ status: "success", changed: true });
    expect(modified).toContain("export async function load(event)");
    expect(modified).toContain("await loadCms(event, { locale: 'en' })");
    expect(modified).toMatch(/return \{\s*cms\s*\};/);
  });

  it.each([
    [
      "no exported load",
      [
        `const load = async ({ locals }) => {`,
        `  return { meta: locals.meta };`,
        `};`,
      ],
    ],
    [
      "a load under another name",
      [
        `export const loadRoot = async ({ locals }) => {`,
        `  return { meta: locals.meta };`,
        `};`,
      ],
    ],
    [
      "an expression-bodied load",
      [`export const load = async ({ locals }) => ({ meta: locals.meta });`],
    ],
    [
      "an early return",
      [
        `export const load = async ({ locals, url }) => {`,
        `  if (url.pathname === '/health') return { ok: true };`,
        `  return { meta: locals.meta };`,
        `};`,
      ],
    ],
    [
      "a non-literal return",
      [
        `export const load = async ({ locals }) => {`,
        `  const data = { meta: locals.meta };`,
        `  return data;`,
        `};`,
      ],
    ],
  ])(
    "reports failure and leaves the file untouched for %s",
    (_label, lines) => {
      const filePath = writeLayoutServer(
        "+layout.server.unrecognised.ts",
        lines.join("\n") + "\n",
      );
      const original = fs.readFileSync(filePath, "utf8");

      const outcome = modifyLayoutServer(filePath);
      const modified = fs.readFileSync(filePath, "utf8");

      expect(outcome.status).toBe("failed");
      if (outcome.status === "failed") {
        expect(outcome.message).toContain("loadCms(event");
      }
      expect(modified).toBe(original);
    },
  );

  it("reports not-found when +layout.server.ts is missing", () => {
    const outcome = modifyLayoutServer(
      path.join(tempDir, "src", "routes", "missing.server.ts"),
    );
    expect(outcome.status).toBe("not-found");
    if (outcome.status === "not-found") {
      expect(outcome.message).toContain("loadCms");
    }
  });

  // --- src/routes/+layout.svelte ---

  it("mounts <AdminBar /> in +layout.svelte", async () => {
    const filePath = path.join(tempDir, LAYOUT_SVELTE);
    const outcome = modifyLayoutSvelte(filePath);

    expect(outcome).toEqual({ status: "success", changed: true });
    await expect(read(LAYOUT_SVELTE)).toMatchFormatted(
      expected(LAYOUT_SVELTE),
      "+layout.svelte",
    );
  });

  it("is idempotent for +layout.svelte", () => {
    const filePath = path.join(tempDir, LAYOUT_SVELTE);

    modifyLayoutSvelte(filePath);
    const first = read(LAYOUT_SVELTE);

    const outcome = modifyLayoutSvelte(filePath);
    const second = read(LAYOUT_SVELTE);

    expect(outcome).toEqual({ status: "success", changed: false });
    expect(second).toBe(first);
  });

  it("reports failure for a layout without a script block", () => {
    const filePath = path.join(tempDir, "src", "routes", "bare.svelte");
    fs.writeFileSync(filePath, "<slot />\n");
    const original = fs.readFileSync(filePath, "utf8");

    const outcome = modifyLayoutSvelte(filePath);
    const modified = fs.readFileSync(filePath, "utf8");

    expect(outcome.status).toBe("failed");
    if (outcome.status === "failed") {
      expect(outcome.message).toContain("<AdminBar />");
    }
    expect(modified).toBe(original);
  });

  it("reports not-found when +layout.svelte is missing", () => {
    const outcome = modifyLayoutSvelte(
      path.join(tempDir, "src", "routes", "missing.svelte"),
    );
    expect(outcome.status).toBe("not-found");
  });
});
