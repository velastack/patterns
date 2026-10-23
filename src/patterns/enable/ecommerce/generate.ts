import type { File, Options, Provider, Result } from "../../../core/types";
import { providerCreates, resolveProvider } from "../../../core/providers";
import { filesFromGlob } from "../../../core/util";

/**
 * The payments providers ecommerce supports. It writes no env of its own:
 * the provider is whichever payments uses, and payments wrote the keys.
 */
export const PROVIDERS: Provider[] = [
  // The cart page's checkout action and the demo page run on the server.
  { id: "stripe", label: "Stripe", requires: { backend: true } },
  { id: "shopify", label: "Shopify" },
  // Checkout opens a WhatsApp chat in the browser; nothing runs on a server.
  { id: "whatsapp", label: "WhatsApp" },
];

export const META = {
  slug: "enable-ecommerce",
  providers: PROVIDERS,
  inheritsProvider: "payments",
};

const createsRaw = import.meta.glob<string>("./creates/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const providersRaw = import.meta.glob<string>("./providers/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const providersAppModeRaw = import.meta.glob<string>(
  "./providers-app-mode/**",
  { query: "?raw", import: "default", eager: true },
);

export interface GenerateContext {
  /**
   * The project has payments' Stripe customer helper, so checkout can attach
   * the signed-in buyer. Only the runtime can look; preview shows the guest
   * version.
   */
  stripeCustomer?: boolean;
}

export async function generate(
  options: Options,
  { stripeCustomer = false }: GenerateContext = {},
) {
  const provider = resolveProvider(META, options);

  const creates = new Map<string, File>();
  const add = (files: File[]) => {
    for (const file of files) creates.set(file.path, file);
  };
  add(Object.values(filesFromGlob(createsRaw, "./creates/")));
  add(providerCreates(providersRaw, provider.id));
  if (provider.id === "stripe" && stripeCustomer) {
    add(
      providerCreates(
        providersAppModeRaw,
        provider.id,
        "./providers-app-mode/",
      ),
    );
  }

  return {
    creates: [...creates.values()].sort((a, b) => a.path.localeCompare(b.path)),
    modifies: [],
    deletes: [],
    components: ["sheet", "button", "badge", "separator"],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
