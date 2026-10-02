import type { Options, Result } from "../../../core/types";
import { WUCHALE, WUCHALE_SVELTE } from "../../../core/constants";
import { composeCreates } from "../../../core/util";
import { resolveUi } from "../../../core/field/ui";

const createsRaw = import.meta.glob<string>("./creates/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

// A plain project gets a native <select> in place of the shadcn one, at the
// same path, so the root layout import and disable-i18n cover both.
const variantsRaw = import.meta.glob<string>("./variants/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const CREATES_PREFIX = "./creates/";

export async function generate(options: Options) {
  const ui = resolveUi(options);
  const creates = composeCreates(
    createsRaw,
    CREATES_PREFIX,
    variantsRaw,
    ui === "plain" ? "plain" : undefined,
  );

  return {
    creates,
    modifies: [],
    deletes: [],
    components: ui === "plain" ? [] : ["select"],
    packages: [WUCHALE, WUCHALE_SVELTE],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
