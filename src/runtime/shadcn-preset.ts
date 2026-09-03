import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { WriteResultRuntime } from "../core/types";
import { readComponentsConfig } from "./registry";
import { executeCommand, formatPaths } from "./write-result";

/**
 * What a shadcn-svelte preset code carries. Mirrors `PresetConfig` from
 * `shadcn-svelte/preset` as plain strings, so this package's types do not
 * depend on a package its consumers may not have installed.
 */
export interface PresetConfig {
  style: string;
  baseColor: string;
  theme: string;
  chartColor?: string;
  iconLibrary: string;
  font: string;
  fontHeading: string;
  radius: string;
  menuAccent: string;
  menuColor: string;
}

/** The part of `shadcn-svelte/preset` this package uses. */
export interface ShadcnPreset {
  PRESET_STYLES: readonly string[];
  PRESET_BASE_COLOR_KEYS: readonly string[];
  PRESET_THEME_KEYS: readonly string[];
  PRESET_FONTS: readonly string[];
  PRESET_ICON_LIBRARIES: readonly string[];
  encodePreset(config: Partial<PresetConfig>): string;
  decodePreset(code: string): PresetConfig | null;
}

export type PresetPart = "theme" | "font";

/**
 * The encoder from the *project's* shadcn-svelte, so every preset code is
 * produced by the same version that consumes it and the value lists can
 * never drift from what `apply` accepts.
 */
export async function loadPreset(root: string): Promise<ShadcnPreset> {
  let resolved: string;
  try {
    resolved = createRequire(path.join(root, "package.json")).resolve(
      "shadcn-svelte/preset",
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not load shadcn-svelte/preset from ${root}: ${reason}\n` +
        "Install the project's dependencies (shadcn-svelte >= 1.6) and try again.",
    );
  }
  const module: unknown = await import(
    /* @vite-ignore */ pathToFileURL(resolved).href
  );
  return module as ShadcnPreset;
}

/**
 * The font each style is designed with. shadcn-svelte keeps this table inside
 * its bundle (the `create` presets) without exporting it, so it is vendored
 * here; `shadcn-preset.test.ts` checks it still covers every style the
 * installed shadcn-svelte knows.
 */
export const STYLE_FONTS: Record<
  string,
  { font: string; fontHeading?: string }
> = {
  nova: { font: "geist" },
  vega: { font: "inter" },
  maia: { font: "figtree" },
  lyra: { font: "jetbrains-mono" },
  mira: { font: "inter" },
  luma: { font: "inter" },
  sera: { font: "noto-sans", fontHeading: "playfair-display" },
  rhea: { font: "inter" },
};

/**
 * A preset code for the project as it is, with `overrides` on top: the style,
 * base color, icon library and menu settings come from `components.json` so
 * an `apply --only theme` keeps everything it does not mean to change.
 * Values shadcn-svelte does not know (a `slate` from an older template) fall
 * back to its defaults inside `encodePreset`.
 */
export async function presetFor(
  root: string,
  overrides: Partial<PresetConfig>,
  preset?: ShadcnPreset,
): Promise<string> {
  const { encodePreset } = preset ?? (await loadPreset(root));
  const config = readComponentsConfig(root);
  const current: Partial<PresetConfig> = { style: config.style };
  if (config.baseColor) current.baseColor = config.baseColor;
  if (config.iconLibrary) current.iconLibrary = config.iconLibrary;
  if (config.menuColor) current.menuColor = config.menuColor;
  if (config.menuAccent) current.menuAccent = config.menuAccent;
  return encodePreset({ ...current, ...overrides });
}

/**
 * `shadcn-svelte apply --preset <code> --only <parts> --yes` through the
 * project's package manager. `theme` rewrites the token values in `:root` /
 * `.dark` and records the base color in `components.json`; `font` adds the
 * fontsource import, dependency and `--font-sans`. Both leave the rest of the
 * stylesheet alone but write it in the registry's formatting, so the file is
 * run through the project's prettier afterwards.
 */
export async function applyPreset(
  root: string,
  code: string,
  only: PresetPart[],
  runtime?: WriteResultRuntime,
): Promise<void> {
  await executeCommand(
    root,
    "execute",
    ["shadcn-svelte", "apply", "--preset", code, "--only", ...only, "--yes"],
    runtime,
  );
  await formatPaths(root, [readComponentsConfig(root).cssPath]);
}
