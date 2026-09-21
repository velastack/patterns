import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import prettier from "prettier";
import dedent from "dedent";

import {
  HOOKS_SERVER_SNIPPET,
  modifyHooksServerI18n,
} from "../../../enable/i18n/modifies/hooks.server";
import { unmodifyViteConfig } from "./vite-config";
import { unmodifySvelteConfig } from "./svelte-config";
import { unmodifyHooksServerI18n } from "./hooks.server";
import { unmodifyAppHtml } from "./app-html";
import { modifyHooksI18n } from "../../../enable/i18n/modifies/hooks";
import { unmodifyHooksI18n } from "./hooks";
import { ensureRootLayoutI18n } from "../../../enable/i18n/modifies/+layout";
import { unmodifyRootLayoutI18n } from "./+layout";
import { unmodifyRootLayoutLanguageSelect } from "./root-layout.svelte";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesPath = path.join(__dirname, "fixtures");
const tempDir = path.join(__dirname, "temp");

const expected = (name: string) =>
  fs.readFileSync(path.join(fixturesPath, "expect", name), "utf8");

describe("disable i18n modifiers", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("removes the wuchale plugin from vite.config.ts", async () => {
    const filePath = path.join(tempDir, "vite.config.ts");
    const outcome = unmodifyViteConfig(filePath);

    expect(outcome).toEqual({ status: "success", changed: true });
    await expect(fs.readFileSync(filePath, "utf8")).toMatchFormatted(
      expected("vite.config.ts"),
      "vite.config.ts",
    );
  });

  it("removes the $locales alias from svelte.config.js", async () => {
    const result = unmodifySvelteConfig(tempDir);

    expect(result.outcome).toEqual({ status: "success", changed: true });
    await expect(fs.readFileSync(result.filePath, "utf8")).toMatchFormatted(
      expected("svelte.config.js"),
      "svelte.config.js",
    );
  });

  it("unwraps the wuchale handle out of hooks.server.ts", async () => {
    const filePath = path.join(tempDir, "hooks.server.ts");
    const outcome = unmodifyHooksServerI18n(filePath);

    expect(outcome).toEqual({ status: "success", changed: true });
    await expect(fs.readFileSync(filePath, "utf8")).toMatchFormatted(
      expected("hooks.server.ts"),
      "hooks.server.ts",
    );
  });

  it("is idempotent for hooks.server.ts", () => {
    const filePath = path.join(tempDir, "hooks.server.ts");
    unmodifyHooksServerI18n(filePath);
    const first = fs.readFileSync(filePath, "utf8");

    const outcome = unmodifyHooksServerI18n(filePath);

    expect(outcome).toEqual({ status: "success", changed: false });
    expect(fs.readFileSync(filePath, "utf8")).toBe(first);
  });

  // enable-i18n then disable-i18n, on the shapes enable composes with.
  it.each([
    [
      "a handle written as a function",
      dedent`
        /** Tags every response with the app version. */
        export async function handle({ event, resolve }) {
          return resolve(event);
        }
      `,
    ],
    [
      "a file with an init and no handle",
      dedent`
        import type { ServerInit } from '@sveltejs/kit';

        export const init: ServerInit = () => {};
      `,
    ],
    [
      "the static template",
      dedent`
        import { handleStatic } from '@velastack/kit';

        /**
         * The footer links to pages that do not exist yet.
         */
        export const handle = handleStatic();
      `,
    ],
  ])("round-trips %s", async (_label, source) => {
    const filePath = path.join(tempDir, "hooks.roundtrip.ts");
    fs.writeFileSync(filePath, source + "\n");

    expect(modifyHooksServerI18n(filePath).status).toBe("success");
    expect(unmodifyHooksServerI18n(filePath)).toEqual({
      status: "success",
      changed: true,
    });

    await expect(fs.readFileSync(filePath, "utf8")).toMatchFormatted(
      source,
      "hooks.server.ts",
    );
  });

  it("reports failure and leaves a handle it cannot unwrap", () => {
    const filePath = path.join(tempDir, "hooks.wrapped.ts");
    const original = `const handleWuchale = () => {};\n\nexport const handle = dev ? handleWuchale : handleProd;\n`;
    fs.writeFileSync(filePath, original);

    expect(unmodifyHooksServerI18n(filePath).status).toBe("failed");
    expect(fs.readFileSync(filePath, "utf8")).toBe(original);
  });

  // However the project's prettier config reshaped it.
  it.each([
    ["as written", { semi: true, trailingComma: "none" }],
    ["reformatted", { semi: false, trailingComma: "all" }],
  ] as const)(
    "empties the hooks.server.ts enable-i18n created (%s)",
    async (_label, options) => {
      const filePath = path.join(tempDir, "hooks.created.ts");
      fs.writeFileSync(
        filePath,
        await prettier.format(HOOKS_SERVER_SNIPPET, {
          parser: "typescript",
          ...options,
        }),
      );

      const outcome = unmodifyHooksServerI18n(filePath);

      expect(outcome).toEqual({ status: "success", changed: true });
      expect(fs.readFileSync(filePath, "utf8").trim()).toBe("");
    },
  );

  it("puts a real lang back in app.html", () => {
    const filePath = path.join(tempDir, "app.html");
    const outcome = unmodifyAppHtml(filePath);

    expect(outcome).toEqual({ status: "success", changed: true });
    expect(fs.readFileSync(filePath, "utf8")).toContain('<html lang="en">');
  });

  it("empties the +layout.ts enable-i18n wrote", () => {
    const filePath = path.join(tempDir, "src", "routes", "+layout.ts");

    // Emptied, not removed: the runtime reports it as a delete.
    expect(unmodifyRootLayoutI18n(filePath)).toEqual({
      status: "success",
      changed: true,
    });
    expect(fs.readFileSync(filePath, "utf8")).toBe("");
  });

  it("keeps the route options a +layout.ts held before i18n", async () => {
    const filePath = path.join(tempDir, "src", "routes", "+layout.plain.ts");
    const source = "export const prerender = true;\n";
    fs.writeFileSync(filePath, source);

    expect(ensureRootLayoutI18n(filePath).status).toBe("success");
    expect(unmodifyRootLayoutI18n(filePath)).toEqual({
      status: "success",
      changed: true,
    });

    await expect(fs.readFileSync(filePath, "utf8")).toMatchFormatted(
      source,
      "+layout.ts",
    );
  });

  it("asks for a hand with a +layout.ts that grew other code", () => {
    const filePath = path.join(tempDir, "src", "routes", "+layout.custom.ts");
    const original = fs.readFileSync(filePath, "utf8");

    expect(unmodifyRootLayoutI18n(filePath).status).toBe("failed");
    expect(fs.readFileSync(filePath, "utf8")).toBe(original);
  });

  it("leaves a +layout.ts without i18n alone", () => {
    const filePath = path.join(tempDir, "src", "routes", "+layout.plain.ts");
    fs.writeFileSync(filePath, "export const prerender = true;\n");
    expect(unmodifyRootLayoutI18n(filePath)).toEqual({
      status: "success",
      changed: false,
    });
  });

  it("empties hooks.ts when the de-localizing reroute was all it held", () => {
    const filePath = path.join(tempDir, "src", "hooks.ts");
    modifyHooksI18n(filePath);

    expect(unmodifyHooksI18n(filePath)).toEqual({
      status: "success",
      changed: true,
    });
    expect(fs.readFileSync(filePath, "utf8")).toBe("");
  });

  it("leaves the reroute content negotiation wrote in hooks.ts", async () => {
    const filePath = path.join(tempDir, "src", "hooks.negotiate.ts");
    const source = dedent`
      import { reroute as negotiateReroute } from '$lib/negotiate';

      export const reroute = ({ url }) => negotiateReroute(url.pathname);
    `;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, source + "\n");

    expect(modifyHooksI18n(filePath).status).toBe("success");
    expect(unmodifyHooksI18n(filePath)).toEqual({
      status: "success",
      changed: true,
    });

    await expect(fs.readFileSync(filePath, "utf8")).toMatchFormatted(
      source,
      "hooks.ts",
    );
  });

  it("reports failure and leaves a reroute it cannot unwrap", () => {
    const filePath = path.join(tempDir, "hooks.reroute.ts");
    const original = dedent`
      const rerouteDeLocalize = (url: string) => url;

      export const reroute = ({ url }) => custom(rerouteDeLocalize(url.pathname));
    `;
    fs.writeFileSync(filePath, original + "\n");

    expect(unmodifyHooksI18n(filePath).status).toBe("failed");
    expect(fs.readFileSync(filePath, "utf8")).toBe(original + "\n");
  });

  it("leaves a hooks.ts without i18n alone", () => {
    const filePath = path.join(tempDir, "hooks.transport.ts");
    const original = "export const transport = {};\n";
    fs.writeFileSync(filePath, original);

    expect(unmodifyHooksI18n(filePath)).toEqual({
      status: "success",
      changed: false,
    });
    expect(fs.readFileSync(filePath, "utf8")).toBe(original);
  });

  it("takes the language select out of the root layout", async () => {
    const filePath = path.join(tempDir, "root-layout.svelte");
    const outcome = unmodifyRootLayoutLanguageSelect(filePath);

    expect(outcome).toEqual({ status: "success", changed: true });
    await expect(fs.readFileSync(filePath, "utf8")).toMatchFormatted(
      expected("root-layout.svelte"),
      "root-layout.svelte",
    );
  });

  it("takes the language select out of a plain layout", () => {
    const filePath = path.join(tempDir, "bare-layout.svelte");
    const outcome = unmodifyRootLayoutLanguageSelect(filePath);

    expect(outcome).toEqual({ status: "success", changed: true });
    // Back to exactly what `sv create` wrote.
    expect(fs.readFileSync(filePath, "utf8")).toBe(
      expected("bare-layout.svelte"),
    );
  });
});
