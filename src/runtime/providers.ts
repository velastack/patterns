import fs from "node:fs";
import path from "node:path";
import { capabilityName, providerMarkers } from "../core/providers";
import type { DetectedProviders, Pattern, ProviderMarker } from "../core/types";
import { readEnvVarNames } from "./env-vars";

type DetectablePattern = Pick<
  Pattern,
  "slug" | "providers" | "inheritsProvider"
>;

/**
 * The provider in use for each capability, read from what the providers left
 * in the project. Nothing records the choice, so this is the only way to know
 * it. A pattern that inherits its provider is skipped: its files say nothing
 * the capability it is built on doesn't already.
 *
 * The registry is passed in rather than imported, so this module and the
 * package entry don't import each other.
 */
export function detectProviders(
  root: string,
  patterns: readonly DetectablePattern[],
): DetectedProviders {
  const detected: DetectedProviders = { providers: {}, ambiguous: [] };
  const present = markerProbe(root);

  for (const pattern of patterns) {
    if (!pattern.providers?.length || pattern.inheritsProvider) continue;
    const ids = pattern.providers
      .filter((provider) => providerMarkers(provider).some(present))
      .map((provider) => provider.id);

    const capability = capabilityName(pattern.slug);
    if (ids.length === 1) detected.providers[capability] = ids[0];
    if (ids.length > 1) detected.ambiguous.push({ capability, ids });
  }

  return detected;
}

/** Checks one marker against the project; `src/env.ts` and `package.json` are read once. */
function markerProbe(root: string): (marker: ProviderMarker) => boolean {
  let envNames: Set<string> | undefined;
  let dependencies: Set<string> | undefined;

  return (marker) => {
    if ("env" in marker) {
      envNames ??= readEnvVarNames(root);
      return envNames.has(marker.env);
    }
    if ("path" in marker) {
      return fs.existsSync(path.join(root, marker.path));
    }
    dependencies ??= readDependencies(root);
    return dependencies.has(marker.dependency);
  };
}

function readDependencies(root: string): Set<string> {
  const file = path.join(root, "package.json");
  if (!fs.existsSync(file)) return new Set();
  try {
    const pkg = JSON.parse(fs.readFileSync(file, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return new Set([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ]);
  } catch {
    return new Set();
  }
}
