import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { RegistryItem, WriteResultRuntime } from "../core/types";
import { RegistryUnavailableError } from "../core/errors";

/**
 * shadcn-svelte's schema defaults. A `components.json` that names no `style`
 * resolves to `nova` (not `vega`, whatever `getRegistryUrl`'s fallback says),
 * which is why the CLI's templates write the key explicitly.
 */
export const DEFAULT_STYLE = "nova";
export const DEFAULT_REGISTRY = "https://shadcn-svelte.com/registry";
export const DEFAULT_CSS_PATH = "src/app.css";

const REGISTRY_TIMEOUT_MS = 10_000;

export interface ComponentsConfig {
  style: string;
  registry: string;
  baseColor?: string;
  iconLibrary?: string;
  menuColor?: string;
  menuAccent?: string;
  aliases: Record<string, string>;
  /** `tailwind.css`: the global stylesheet, relative to the root. */
  cssPath: string;
}

interface RawComponentsConfig {
  style?: unknown;
  registry?: unknown;
  iconLibrary?: unknown;
  menuColor?: unknown;
  menuAccent?: unknown;
  tailwind?: { css?: unknown; baseColor?: unknown };
  aliases?: Record<string, unknown>;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * The project's `components.json` with the schema defaults filled in. A
 * missing or unreadable file behaves like an empty one, so callers can still
 * compute paths and the existence checks here agree with shadcn's own.
 */
export function readComponentsConfig(root: string): ComponentsConfig {
  let raw: RawComponentsConfig = {};
  const configPath = path.join(root, "components.json");
  if (existsSync(configPath)) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(configPath, "utf8"));
      if (parsed && typeof parsed === "object") {
        raw = parsed as RawComponentsConfig;
      }
    } catch {
      raw = {};
    }
  }

  const aliases: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw.aliases ?? {})) {
    const alias = optionalString(value);
    if (alias) aliases[key] = alias;
  }

  return {
    style: optionalString(raw.style) ?? DEFAULT_STYLE,
    registry: optionalString(raw.registry) ?? DEFAULT_REGISTRY,
    baseColor: optionalString(raw.tailwind?.baseColor),
    iconLibrary: optionalString(raw.iconLibrary),
    menuColor: optionalString(raw.menuColor),
    menuAccent: optionalString(raw.menuAccent),
    aliases,
    cssPath: optionalString(raw.tailwind?.css) ?? DEFAULT_CSS_PATH,
  };
}

/** `${registry}/styles/${style}/index.json`: the items one style offers. */
export function registryIndexUrl(registry: string, style: string): string {
  return `${registry.replace(/\/+$/, "")}/styles/${encodeURIComponent(style)}/index.json`;
}

/**
 * One request per registry URL per process, keyed on the fetch implementation
 * so an injected test double never sees another test's answer and the real
 * `fetch` shares its answer across a style switch and the installs it runs.
 */
const indexCache = new WeakMap<
  typeof fetch,
  Map<string, Promise<RegistryItem[]>>
>();

function parseIndex(body: unknown): RegistryItem[] {
  if (!Array.isArray(body)) {
    throw new Error("the index is not a list");
  }
  const items: RegistryItem[] = [];
  for (const entry of body) {
    if (!entry || typeof entry !== "object") continue;
    const { name, type } = entry as { name?: unknown; type?: unknown };
    if (typeof name === "string" && typeof type === "string") {
      items.push({ name, type });
    }
  }
  return items;
}

async function requestIndex(
  url: string,
  fetchImpl: typeof fetch,
): Promise<RegistryItem[]> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS),
    });
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "TimeoutError"
        ? `no answer within ${REGISTRY_TIMEOUT_MS / 1000}s`
        : error instanceof Error
          ? error.message
          : String(error);
    throw new RegistryUnavailableError(url, reason);
  }
  if (!response.ok) {
    throw new RegistryUnavailableError(url, `HTTP ${response.status}`);
  }
  try {
    return parseIndex(await response.json());
  } catch (error) {
    throw new RegistryUnavailableError(
      url,
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * The items the project's registry offers for a style: the configured one by
 * default, or `options.style` to look at the style a project is about to
 * switch to. Throws `RegistryUnavailableError` when the index cannot be read.
 */
export async function fetchRegistryIndex(
  root: string,
  options: { style?: string; runtime?: WriteResultRuntime } = {},
): Promise<RegistryItem[]> {
  const config = readComponentsConfig(root);
  const url = registryIndexUrl(config.registry, options.style ?? config.style);
  const fetchImpl = options.runtime?.fetch ?? globalThis.fetch;

  let cache = indexCache.get(fetchImpl);
  if (!cache) {
    cache = new Map();
    indexCache.set(fetchImpl, cache);
  }
  let pending = cache.get(url);
  if (!pending) {
    pending = requestIndex(url, fetchImpl).catch((error: unknown) => {
      // A failed read is not worth remembering: the next command may be online.
      cache.delete(url);
      throw error;
    });
    cache.set(url, pending);
  }
  return pending;
}
