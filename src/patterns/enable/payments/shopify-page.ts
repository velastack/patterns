import dedent from "dedent";

/** The demo page: one Buy button for the variant named on the command line. */
export function buyPageSnippet(variantId: string): string {
  return dedent`
    <script lang="ts">
      import BuyButton from '#lib/components/payments/buy-button.svelte';
    </script>

    <section data-role="content">
      <BuyButton variantId="${variantId}" />
    </section>
  `;
}
