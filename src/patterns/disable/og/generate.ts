import type { Options, Result } from "../../../core/types";
import { toDeleteEntry } from "../../destroy/shared";
import { createdPaths } from "../../enable/og/generate";

export async function generate(_options: Options) {
  return {
    creates: [],
    modifies: [],
    // A card.svelte the project has redesigned goes too; that is what
    // `--destructive` is asked for.
    deletes: createdPaths().map(toDeleteEntry),
    components: [],
    packages: [],
    uninstalls: ["@takumi-rs/core"],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
