import dedent from "dedent";
import type { File, Options, Result } from "../../../core/types";
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

/** WhatsApp has no demo prompt; the preview shows one priced item and one quoted in the chat. */
const WHATSAPP_SHOP: File = {
  path: "src/routes/(public)/shop/+page.svelte",
  language: "svelte",
  content:
    dedent`
      <script lang="ts">
        import AddToCart from '#lib/components/cart/add-to-cart.svelte';
      </script>

      <section data-role="content">
        <h1 class="mb-6 text-2xl font-semibold">Shop</h1>
        <div class="flex gap-2">
          <AddToCart id="sourdough" name="Sourdough loaf" price={4.5} currency="EUR" />
          <AddToCart id="birthday-cake" name="Birthday cake" />
        </div>
      </section>
    ` + "\n",
  status: "success",
};

export async function generate(options: Options) {
  const provider = resolveProvider(META, options);

  return {
    creates:
      provider.id === "whatsapp"
        ? [WHATSAPP_SHOP]
        : demoPage(provider.id, PREVIEW_IDS[provider.id]!),
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
