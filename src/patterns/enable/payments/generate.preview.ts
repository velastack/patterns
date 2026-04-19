import dedent from "dedent";
import type { File, Options, Result } from "../../../core/types";
import { appRelativePath, languageFromPath } from "../../../core/util";
import {
  PAYMENTS_APP_MODE_COLLECTIONS,
  PAYMENTS_BASE_COLLECTIONS,
} from "./runtime/collections";

const previewRaw = import.meta.glob<string>("./preview-modifies/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const PREVIEW_PREFIX = "./preview-modifies/";

const PREVIEW_PRICE_ID = "price_preview_placeholder";

function paymentPageSnippet(priceId: string): string {
  return dedent`
    <script lang="ts">
      import PaymentButton from '$lib/components/payments/payment-button.svelte';
    </script>

    <section data-role="content">
      <PaymentButton priceId="${priceId}" />
    </section>
  `;
}

export async function generate(options: Options) {
  const isAppMode = options.features.auth;

  const modifies: File[] = Object.entries(previewRaw)
    .map(([key, content]) => {
      const path = appRelativePath(key, PREVIEW_PREFIX);
      return {
        path,
        language: languageFromPath(path),
        content,
        status: "success" as const,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  const paymentPage: File = {
    path: "src/routes/(public)/payment/+page.svelte",
    language: "svelte",
    content: paymentPageSnippet(PREVIEW_PRICE_ID),
    status: "success",
  };

  const collections = [
    ...PAYMENTS_BASE_COLLECTIONS,
    ...(isAppMode ? PAYMENTS_APP_MODE_COLLECTIONS : []),
  ];

  return {
    creates: [paymentPage],
    modifies,
    deletes: [],
    components: [],
    packages: [],
    collections,
    collectionPatches: [],
  } satisfies Result;
}
