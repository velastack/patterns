import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExecuteCommand } from "../core/types";
import {
  applyPreset,
  loadPreset,
  presetFor,
  STYLE_FONTS,
  type ShadcnPreset,
} from "./shadcn-preset";

/** This repo's own devDependency: the same package a project resolves. */
const REPO_ROOT = process.cwd();

const tempDirs: string[] = [];

/**
 * A throwaway project whose `node_modules/shadcn-svelte` is this repo's, so
 * `loadPreset` resolves the way it does in a real project.
 */
export function makePresetProject(
  config: Record<string, unknown> = {},
): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "shadcn-preset-"));
  tempDirs.push(root);
  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "tmp", devDependencies: {} }),
    "utf8",
  );
  mkdirSync(path.join(root, "node_modules"), { recursive: true });
  symlinkSync(
    path.join(REPO_ROOT, "node_modules", "shadcn-svelte"),
    path.join(root, "node_modules", "shadcn-svelte"),
    "dir",
  );
  writeFileSync(
    path.join(root, "components.json"),
    JSON.stringify(config, null, "\t"),
    "utf8",
  );
  return root;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("loadPreset", () => {
  it("loads shadcn-svelte/preset from the project's install", async () => {
    const preset = await loadPreset(REPO_ROOT);
    expect(preset.PRESET_STYLES).toContain("vega");
    expect(preset.PRESET_BASE_COLOR_KEYS).toContain("zinc");
    expect(preset.PRESET_THEME_KEYS).toContain("blue");
    expect(
      preset.decodePreset(preset.encodePreset({ style: "vega" })),
    ).toMatchObject({ style: "vega" });
  });

  it("explains what to do when shadcn-svelte is not installed", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "no-shadcn-"));
    tempDirs.push(root);
    await expect(loadPreset(root)).rejects.toThrow(
      /Could not load shadcn-svelte\/preset from .*Install the project's dependencies/s,
    );
  });
});

describe("STYLE_FONTS", () => {
  // The table is vendored; this is the alarm that shadcn-svelte added a style
  // (or a font) it does not cover.
  it("covers every style the installed shadcn-svelte knows, with fonts it offers", async () => {
    const preset = await loadPreset(REPO_ROOT);
    for (const style of preset.PRESET_STYLES) {
      expect(STYLE_FONTS, `no font row for style ${style}`).toHaveProperty(
        style,
      );
    }
    for (const [style, fonts] of Object.entries(STYLE_FONTS)) {
      expect(preset.PRESET_STYLES, `stale style ${style}`).toContain(style);
      expect(preset.PRESET_FONTS).toContain(fonts.font);
      if (fonts.fontHeading) {
        expect(preset.PRESET_FONTS).toContain(fonts.fontHeading);
      }
    }
  });
});

describe("presetFor", () => {
  let preset: ShadcnPreset;
  async function decode(
    root: string,
    overrides: Parameters<typeof presetFor>[1],
  ) {
    preset ??= await loadPreset(REPO_ROOT);
    return preset.decodePreset(await presetFor(root, overrides, preset));
  }

  it("carries the project's config and puts the overrides on top", async () => {
    const root = makePresetProject({
      style: "vega",
      tailwind: { baseColor: "zinc" },
      iconLibrary: "lucide",
      menuColor: "inverted",
      menuAccent: "bold",
    });
    expect(await decode(root, { theme: "blue" })).toMatchObject({
      style: "vega",
      baseColor: "zinc",
      theme: "blue",
      iconLibrary: "lucide",
      menuColor: "inverted",
      menuAccent: "bold",
    });
    expect(await decode(root, { style: "nova", font: "geist" })).toMatchObject({
      style: "nova",
      baseColor: "zinc",
      font: "geist",
    });
  });

  it("lets shadcn-svelte default a base color it no longer knows", async () => {
    const root = makePresetProject({
      style: "vega",
      tailwind: { baseColor: "slate" },
    });
    expect(await decode(root, {})).toMatchObject({
      style: "vega",
      baseColor: "neutral",
    });
  });

  it("loads the preset module itself when none is given", async () => {
    const root = makePresetProject({ style: "lyra" });
    const code = await presetFor(root, {});
    preset ??= await loadPreset(REPO_ROOT);
    expect(preset.decodePreset(code)).toMatchObject({ style: "lyra" });
  });
});

describe("applyPreset", () => {
  it("runs shadcn-svelte apply and formats the stylesheet the project's way", async () => {
    const root = makePresetProject({
      style: "vega",
      tailwind: { css: "src/app.css" },
    });
    writeFileSync(
      path.join(root, ".prettierrc"),
      JSON.stringify({ singleQuote: true, useTabs: true }),
      "utf8",
    );
    const css = path.join(root, "src", "app.css");
    mkdirSync(path.dirname(css), { recursive: true });
    writeFileSync(css, "@import 'tailwindcss';\n", "utf8");

    // `apply` writes the registry's double quotes and two-space indentation.
    const executeCommand = vi.fn<ExecuteCommand>(async () => {
      writeFileSync(
        css,
        '@import "tailwindcss";\n@import "shadcn-svelte/tailwind.css";\n\n:root {\n  --radius: 0.625rem;\n}\n',
        "utf8",
      );
    });

    await applyPreset(root, "bJLYpge", ["theme"], { executeCommand });

    expect(executeCommand).toHaveBeenCalledWith(root, "execute", [
      "shadcn-svelte",
      "apply",
      "--preset",
      "bJLYpge",
      "--only",
      "theme",
      "--yes",
    ]);
    expect(readFileSync(css, "utf8")).toBe(
      "@import 'tailwindcss';\n@import 'shadcn-svelte/tailwind.css';\n\n:root {\n\t--radius: 0.625rem;\n}\n",
    );
  });

  it("passes every requested part and copes with a stylesheet apply did not create", async () => {
    const root = makePresetProject({ style: "vega" });
    const executeCommand = vi.fn<ExecuteCommand>(async () => {});

    await applyPreset(root, "b2fA", ["theme", "font"], { executeCommand });

    expect(executeCommand.mock.calls[0]?.[2]).toEqual([
      "shadcn-svelte",
      "apply",
      "--preset",
      "b2fA",
      "--only",
      "theme",
      "font",
      "--yes",
    ]);
    expect(existsSync(path.join(root, "src", "app.css"))).toBe(false);
  });
});
