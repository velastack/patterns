import dedent from "dedent";
import type { File, Options, Result } from "../../../core/types";
import { resolveProvider } from "../../../core/providers";
import { filesUnderPrefix } from "../../../core/util";
import { envEditsFor, META } from "./generate";
import { buyPageSnippet } from "./shopify-page";
import { siteModule } from "../../../runtime/site";
import {
  PAYMENTS_APP_MODE_COLLECTIONS,
  PAYMENTS_BASE_COLLECTIONS,
} from "./runtime/collections";

const previewRaw = import.meta.glob<string>("./preview-modifies/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const PREVIEW_PRICE_ID = "price_preview_placeholder";
const PREVIEW_VARIANT_ID = "gid://shopify/ProductVariant/preview";

function orderPageSnippet(): string {
  return dedent`
    <script lang="ts">
      import OrderButton from '#lib/components/payments/order-button.svelte';
    </script>

    <section data-role="content">
      <OrderButton name="Sourdough loaf" price={4.5} />
    </section>
  `;
}

function paymentPageSnippet(priceId: string): string {
  return dedent`
    <script lang="ts">
      import PaymentButton from '#lib/components/payments/payment-button.svelte';
    </script>

    <section data-role="content">
      <PaymentButton priceId="${priceId}" />
    </section>
  `;
}

export async function generate(options: Options) {
  const provider = resolveProvider(META, options);
  const isStripe = provider.id === "stripe";
  const isAppMode = options.features.auth;

  const modifies = Object.values(
    filesUnderPrefix(previewRaw, `./preview-modifies/${provider.id}/`),
  );
  // Built, not stored: Vite will not serve a file named `.env`, and these are
  // the lines the runtime writes.
  modifies.push({
    path: ".env",
    language: "text",
    content:
      envEditsFor(provider)
        .map((edit) =>
          edit.type === "comment"
            ? `# ${edit.key}`
            : `${edit.key}=${edit.value}`,
        )
        .join("\n") + "\n",
    status: "success",
  });
  // The business's currency, which every WhatsApp price is in.
  if (provider.id === "whatsapp") {
    modifies.push({
      path: "src/lib/site.ts",
      language: "typescript",
      content: siteModule("My App", undefined, "EUR"),
      status: "success",
    });
  }
  modifies.sort((a, b) => a.path.localeCompare(b.path));

  const paymentPage: File = {
    path: "src/routes/(public)/payment/+page.svelte",
    language: "svelte",
    content:
      provider.id === "stripe"
        ? paymentPageSnippet(PREVIEW_PRICE_ID)
        : provider.id === "shopify"
          ? buyPageSnippet(PREVIEW_VARIANT_ID)
          : orderPageSnippet(),
    status: "success",
  };

  const collections = isStripe
    ? [
        ...PAYMENTS_BASE_COLLECTIONS,
        ...(isAppMode ? PAYMENTS_APP_MODE_COLLECTIONS : []),
      ]
    : [];

  return {
    creates: [paymentPage],
    modifies,
    deletes: [],
    components: [],
    packages: [],
    collections,
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
