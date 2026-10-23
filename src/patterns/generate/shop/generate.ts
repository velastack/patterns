import type { File, Options, Provider, Result } from "../../../core/types";
import { providerCreates, resolveProvider } from "../../../core/providers";

/**
 * The payments providers a shop can be generated for. The pages are each
 * provider's own: Stripe's read the synced catalog on the server, Shopify's
 * query the Storefront API, WhatsApp's read a module the developer edits (or
 * the CMS, when the project has one). Nothing is shared between them.
 */
export const PROVIDERS: Provider[] = [
  // The listing and product pages read PocketBase on the server.
  { id: "stripe", label: "Stripe", requires: { backend: true } },
  { id: "shopify", label: "Shopify" },
  { id: "whatsapp", label: "WhatsApp" },
];

export const META = {
  slug: "generate-shop",
  providers: PROVIDERS,
  inheritsProvider: "payments",
};

const providersRaw = import.meta.glob<string>("./providers/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

// With the CMS, the catalog is content edited in place rather than a module.
const providersCmsRaw = import.meta.glob<string>("./providers-cms/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** The files `generate-shop` writes for `provider`, as app-relative paths. */
export function shopFiles(options: Options): File[] {
  const provider = resolveProvider(META, options);
  const files = new Map<string, File>();
  for (const file of providerCreates(providersRaw, provider.id)) {
    files.set(file.path, file);
  }
  if (options.features.cms) {
    const cms = providerCreates(
      providersCmsRaw,
      provider.id,
      "./providers-cms/",
    );
    if (cms.length > 0) {
      // The CMS pages replace the module and its pages wholesale.
      files.clear();
      for (const file of cms) files.set(file.path, file);
    }
  }
  return [...files.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export async function generate(options: Options) {
  return {
    creates: shopFiles(options),
    modifies: [],
    deletes: [],
    components: ["button"],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
