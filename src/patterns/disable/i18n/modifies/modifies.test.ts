import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import prettier from "prettier";

import { HOOKS_SERVER_SNIPPET } from "../../../enable/i18n/modifies/hooks.server";
import { unmodifyViteConfig } from "./vite-config";
import { unmodifySvelteConfig } from "./svelte-config";
import { unmodifyHooksServerI18n } from "./hooks.server";
import { unmodifyAppHtml } from "./app-html";
import { planRootLayoutRevert } from "./+layout";
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

  it("plans to delete the +layout.ts enable-i18n wrote", () => {
    expect(
      planRootLayoutRevert(path.join(tempDir, "src", "routes", "+layout.ts")),
    ).toEqual({ action: "delete" });
  });

  it("asks for a hand with a +layout.ts that grew other code", () => {
    const plan = planRootLayoutRevert(
      path.join(tempDir, "src", "routes", "+layout.custom.ts"),
    );
    expect(plan.action).toBe("failed");
  });

  it("leaves a +layout.ts without i18n alone", () => {
    const filePath = path.join(tempDir, "src", "routes", "+layout.plain.ts");
    fs.writeFileSync(filePath, "export const prerender = true;\n");
    expect(planRootLayoutRevert(filePath)).toEqual({ action: "none" });
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
});
