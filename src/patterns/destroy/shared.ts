import type { CollectionDropSpec, Options, Result } from "../../core/types";

/**
 * Invert a forward pattern's Result for destroy: turn `creates` into `deletes`,
 * clear fields that don't apply in reverse (packages/components are retained
 * per plan; collections become `collectionDrops` via separate logic if needed).
 */
export function inverseCreates(forward: Result): Result {
  return {
    creates: [],
    modifies: [],
    deletes: [...forward.creates],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
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
