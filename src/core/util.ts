import type { File, Result } from "./types";

export function appRelativePath(globKey: string, prefix: string): string {
  if (globKey.startsWith(prefix)) {
    return globKey.slice(prefix.length);
  }
  return globKey.replace(/^\.\//, "");
}

export function languageFromPath(path: string): string {
  if (path.endsWith(".svelte")) return "svelte";
  if (path.endsWith(".tsx")) return "ts";
  if (path.endsWith(".ts")) return "ts";
  if (path.endsWith(".jsx")) return "js";
  if (path.endsWith(".js")) return "js";
  return "text";
}

export function filesFromGlob(
  raw: Record<string, string>,
  prefix: string,
): Record<string, File> {
  const files: Record<string, File> = {};
  for (const [key, content] of Object.entries(raw)) {
    const path = appRelativePath(key, prefix);
    files[path] = {
      path,
      language: languageFromPath(path),
      content,
      status: "success",
    };
  }
  return files;
}

/**
 * Compose `creates/` files with an optional variant overlay from `variants/<variant>/`.
 * Files in the variant directory override files in creates at the same relative path.
 * Unknown or empty `variant` → no overlay applied.
 */
export function composeCreates(
  createsRaw: Record<string, string>,
  createsPrefix: string,
  variantsRaw?: Record<string, string>,
  variant?: string,
): File[] {
  const files = filesFromGlob(createsRaw, createsPrefix);
  if (variantsRaw && typeof variant === "string" && variant.length > 0) {
    const variantPrefix = `./variants/${variant}/`;
    const filtered: Record<string, string> = {};
    for (const [key, content] of Object.entries(variantsRaw)) {
      if (key.startsWith(variantPrefix)) filtered[key] = content;
    }
    Object.assign(files, filesFromGlob(filtered, variantPrefix));
  }
  return Object.values(files).sort((a, b) => a.path.localeCompare(b.path));
}

export function mergeResults(results: Result[]) {
  return results.reduce(
    (acc, result) => {
      acc.creates.push(...result.creates);
      acc.modifies.push(...result.modifies);
      acc.deletes.push(...result.deletes);
      acc.components.push(...result.components);
      acc.packages.push(...result.packages);
      acc.collections.push(...result.collections);
      acc.collectionPatches.push(...result.collectionPatches);
      acc.collectionDrops.push(...result.collectionDrops);
      return acc;
    },
    {
      creates: [],
      modifies: [],
      deletes: [],
      components: [],
      packages: [],
      collections: [],
      collectionPatches: [],
      collectionDrops: [],
    } satisfies Result,
  );
}
