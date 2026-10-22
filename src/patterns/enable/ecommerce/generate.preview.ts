import type { Options, Result } from "../../../core/types";
import { resolveProvider } from "../../../core/providers";
import { filesFromGlob } from "../../../core/util";
import { demoPage } from "./demo-page";
import { META } from "./generate";

const previewRaw = import.meta.glob<string>("./preview-modifies/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const PREVIEW_IDS: Record<string, string> = {
  stripe: "price_preview_placeholder",
  shopify: "gid://shopify/ProductVariant/preview",
};

export async function generate(options: Options) {
  const provider = resolveProvider(META, options);

  return {
    creates: demoPage(provider.id, PREVIEW_IDS[provider.id]!),
    modifies: Object.values(
      filesFromGlob(previewRaw, "./preview-modifies/"),
    ).sort((a, b) => a.path.localeCompare(b.path)),
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
