import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  ApplyBaseColorOptions,
  ApplyColorsResult,
  ApplyThemeOptions,
  Component,
  ListComponentsOptions,
  ListComponentsResult,
  RegistryItem,
  SwitchStyleOptions,
  SwitchStyleResult,
  WriteResultRuntime,
} from "../core/types";
import { InvalidArgumentError, RegistryUnavailableError } from "../core/errors";
import { getLogger } from "../core/logger";
import { fetchRegistryIndex, readComponentsConfig } from "./registry";
import {
  applyPreset,
  loadPreset,
  presetFor,
  STYLE_FONTS,
  type ShadcnPreset,
} from "./shadcn-preset";
import {
  getAllCustomComponents,
  installComponents,
  installedComponents,
  installedPackagesFromProject,
  isCustomComponent,
} from "./write-result";

const COMPONENTS_JSON = "components.json";

/**
 * What a project has and what it could add: the ui directory, this package's
 * bundled components, and the registry index of the configured style. A
 * registry that cannot be read leaves the first two intact and says why.
 */
export async function listComponents(
  options: ListComponentsOptions,
  runtime?: WriteResultRuntime,
): Promise<ListComponentsResult> {
  const { root } = options;
  const { style } = readComponentsConfig(root);
  const result: ListComponentsResult = {
    style,
    installed: installedComponents(root),
    custom: getAllCustomComponents(),
    registry: [],
  };
  try {
    result.registry = await fetchRegistryIndex(root, { runtime });
  } catch (error) {
    if (!(error instanceof RegistryUnavailableError)) throw error;
    result.registryUnavailable = error.message;
  }
  return result;
}

function assertOneOf(
  kind: string,
  value: string,
  choices: readonly string[],
): void {
  if (choices.includes(value)) return;
  throw new InvalidArgumentError(
    `Unknown ${kind} "${value}". Choose one of: ${choices.join(", ")}.`,
  );
}

/**
 * Rewrites `style` in `components.json` and nothing else, keeping the file's
 * indentation so the change reads as the one-line diff it is.
 */
function writeStyle(root: string, style: string): void {
  const configPath = path.join(root, COMPONENTS_JSON);
  if (!existsSync(configPath)) {
    throw new Error(
      `${COMPONENTS_JSON} not found in ${root}; this does not look like a shadcn-svelte project.`,
    );
  }
  const text = readFileSync(configPath, "utf8");
  const config = JSON.parse(text) as Record<string, unknown>;
  config.style = style;
  const indent = text.includes("\n\t") ? "\t" : 2;
  writeFileSync(
    configPath,
    `${JSON.stringify(config, null, indent)}\n`,
    "utf8",
  );
}

function registryUiNames(index: RegistryItem[]): Set<string> {
  return new Set(
    index
      .filter((item) => item.type === "registry:ui")
      .map((item) => item.name),
  );
}

/**
 * Moves a project to another shadcn-svelte style. Every installed component
 * the new style's registry also offers is re-added from there (their local
 * edits are lost, which is what `confirm` is for); this package's own
 * components and anything the registry does not know are left alone. The
 * style's preset font follows unless `font` is false.
 */
export async function switchStyle(
  options: SwitchStyleOptions,
  runtime?: WriteResultRuntime,
): Promise<SwitchStyleResult> {
  const { root, style, font = true } = options;
  const logger = getLogger(options);
  const preset = await loadPreset(root);
  assertOneOf("style", style, preset.PRESET_STYLES);

  const unchanged: SwitchStyleResult = {
    status: "unchanged",
    style,
    reinstalled: [],
    filesModified: [],
    packages: [],
    hints: [],
  };
  if (readComponentsConfig(root).style === style) {
    return unchanged;
  }

  const index = await fetchRegistryIndex(root, { style, runtime });
  const offered = registryUiNames(index);
  const reinstall = installedComponents(root).filter(
    (component) => offered.has(component) && !isCustomComponent(component),
  );

  if (options.confirm && !(await options.confirm(reinstall))) {
    return { ...unchanged, status: "cancelled" };
  }

  const packagesBefore = installedPackagesFromProject(root);
  writeStyle(root, style);
  const filesModified = [COMPONENTS_JSON];

  let reinstalled: Component[] = [];
  if (reinstall.length > 0) {
    const outcome = await installComponents(
      { root, components: reinstall, overwrite: true, logger },
      runtime,
    );
    reinstalled = outcome.installed;
  }

  const hints: string[] = [];
  if (font) {
    await applyStyleFont(
      root,
      style,
      preset,
      runtime,
      filesModified,
      hints,
      logger,
    );
  }

  const packages = [...installedPackagesFromProject(root)]
    .filter((name) => !packagesBefore.has(name))
    .sort();

  return {
    status: "switched",
    style,
    reinstalled,
    filesModified,
    packages,
    hints,
  };
}

const FONTSOURCE_IMPORT =
  /@import\s+["']@fontsource(?:-variable)?\/([^"']+)["']/g;

/** The fontsource families a stylesheet imports, in order. */
function fontsourceImports(css: string): string[] {
  return [...css.matchAll(FONTSOURCE_IMPORT)].map((match) => match[1]!);
}

async function applyStyleFont(
  root: string,
  style: string,
  preset: ShadcnPreset,
  runtime: WriteResultRuntime | undefined,
  filesModified: string[],
  hints: string[],
  logger: ReturnType<typeof getLogger>,
): Promise<void> {
  const fonts = STYLE_FONTS[style];
  if (!fonts) {
    logger.info(
      `No preset font is known for the ${style} style; leaving fonts unchanged.`,
    );
    return;
  }
  logger.info(`Applying the ${style} font (${fonts.font})`);
  const code = await presetFor(root, { style, ...fonts }, preset);
  await applyPreset(root, code, ["font"], runtime);

  const cssPath = readComponentsConfig(root).cssPath;
  filesModified.push(cssPath, "package.json");

  // `apply --only font` adds the new font beside whatever was imported before
  // and leaves it to the project to drop the old one; a font nobody uses
  // still ships to every visitor.
  const cssFile = path.join(root, cssPath);
  if (existsSync(cssFile)) {
    const wanted = new Set([fonts.font, fonts.fontHeading].filter(Boolean));
    const stale = fontsourceImports(readFileSync(cssFile, "utf8")).filter(
      (family) => !wanted.has(family),
    );
    if (stale.length > 0) {
      hints.push(
        `${cssPath} still imports ${stale.map((f) => `@fontsource-variable/${f}`).join(", ")} from the previous style; remove the import and the package if nothing else uses them.`,
      );
    }
  }
}

async function applyColors(
  root: string,
  overrides: { baseColor?: string; theme: string },
  runtime?: WriteResultRuntime,
): Promise<ApplyColorsResult> {
  const preset = await loadPreset(root);
  if (overrides.baseColor) {
    assertOneOf(
      "base color",
      overrides.baseColor,
      preset.PRESET_BASE_COLOR_KEYS,
    );
  }
  assertOneOf("theme", overrides.theme, preset.PRESET_THEME_KEYS);

  // Charts follow the accent, as shadcn-svelte's own presets do.
  const code = await presetFor(
    root,
    { ...overrides, chartColor: overrides.theme },
    preset,
  );
  await applyPreset(root, code, ["theme"], runtime);

  const config = readComponentsConfig(root);
  return {
    baseColor: config.baseColor ?? overrides.baseColor ?? "",
    theme: overrides.theme,
    filesModified: [config.cssPath, COMPONENTS_JSON],
  };
}

/**
 * Sets the base (gray) palette. The accent is reset to the base color as
 * well, since `components.json` records only the base color; `applyTheme`
 * puts an accent back on top.
 */
export async function applyBaseColor(
  options: ApplyBaseColorOptions,
  runtime?: WriteResultRuntime,
): Promise<ApplyColorsResult> {
  return applyColors(
    options.root,
    { baseColor: options.color, theme: options.color },
    runtime,
  );
}

/** Sets the accent (primary, ring, charts) and keeps the base palette. */
export async function applyTheme(
  options: ApplyThemeOptions,
  runtime?: WriteResultRuntime,
): Promise<ApplyColorsResult> {
  return applyColors(options.root, { theme: options.theme }, runtime);
}
