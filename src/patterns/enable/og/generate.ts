import { TAKUMI } from "../../../core/constants";
import type { Options, Result } from "../../../core/types";
import { filesFromGlob } from "../../../core/util";

const createsRaw = import.meta.glob<string>("./creates/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const CREATES_PREFIX = "./creates/";

/** The paths this pattern writes; disable-og deletes the same ones. */
export function createdPaths(): string[] {
  return Object.keys(filesFromGlob(createsRaw, CREATES_PREFIX)).sort();
}

export async function generate(_options: Options) {
  const creates = Object.values(filesFromGlob(createsRaw, CREATES_PREFIX)).sort(
    (a, b) => a.path.localeCompare(b.path),
  );

  return {
    creates,
    modifies: [],
    deletes: [],
    components: [],
    packages: [TAKUMI],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
