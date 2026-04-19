import type { Result } from "./types";

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
    } satisfies Result,
  );
}
