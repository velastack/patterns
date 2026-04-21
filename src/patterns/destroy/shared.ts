import type {
  CollectionDropSpec,
  File,
  Options,
} from "../../core/types";
import { languageFromPath } from "../../core/util";

export function toDeleteEntry(path: string): File {
  return {
    path,
    language: languageFromPath(path),
    content: "",
    status: "success",
  };
}

/**
 * Build `CollectionDropSpec` entries for each collection name, with live row
 * counts from PocketBase when `env === "runtime"`. In preview mode, returns
 * `{ exists: true, rowCount: 0 }` placeholders.
 */
export async function planDropsForCollections(
  collectionNames: string[],
  options: Options,
): Promise<CollectionDropSpec[]> {
  if (collectionNames.length === 0) return [];

  if (options.env !== "runtime") {
    return collectionNames.map((name) => ({
      name,
      exists: true,
      rowCount: 0,
    }));
  }

  const { withPocketbase } = await import("../../runtime/pocketbase");
  const { planCollectionDrops } = await import("../../runtime/collections");
  const drops: CollectionDropSpec[] = [];
  await withPocketbase(options.root, async (pb) => {
    const plans = await planCollectionDrops(pb, collectionNames);
    drops.push(...plans);
  });
  return drops;
}
