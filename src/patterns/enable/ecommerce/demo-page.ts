import dedent from "dedent";
import type { File } from "../../../core/types";
import { languageFromPath } from "../../../core/util";

const SHOP = "src/routes/(public)/shop";

function file(path: string, content: string): File {
  return { path, language: languageFromPath(path), content, status: "success" };
}

/**
 * A one-item shop page to try the cart with. Stripe's loads the price the
 * sync workflow copied into PocketBase; Shopify's names the variant inline.
 */
export function demoPage(provider: string, id: string): File[] {
  if (provider === "shopify") {
    return [
      file(
        `${SHOP}/+page.svelte`,
        dedent`
          <script lang="ts">
            import AddToCart from '#lib/components/cart/add-to-cart.svelte';
          </script>

          <section data-role="content">
            <h1 class="mb-6 text-2xl font-semibold">Shop</h1>
            <AddToCart merchandiseId="${id}" />
          </section>
        ` + "\n",
      ),
    ];
  }

  return [
    file(
      `${SHOP}/+page.server.ts`,
      dedent`
        import { error } from '@sveltejs/kit';

        export const load = async ({ locals }) => {
          try {
            const price = await locals.admin.collection('stripe_prices').getOne('${id}');
            const product = await locals.admin.collection('stripe_products').getOne(price.product ?? '');
            return {
              price: {
                price: price.id,
                name: product.name ?? price.id,
                unitAmount: price.unit_amount ?? 0,
                currency: price.currency ?? 'usd'
              }
            };
          } catch {
            // The catalog syncs from Stripe every ten minutes.
            error(404, 'This price has not synced from Stripe yet.');
          }
        };
      ` + "\n",
    ),
    file(
      `${SHOP}/+page.svelte`,
      dedent`
        <script lang="ts">
          import AddToCart from '#lib/components/cart/add-to-cart.svelte';
          import { formatAmount } from '#lib/cart.svelte.js';

          let { data } = $props();
        </script>

        <section data-role="content">
          <h1 class="mb-2 text-2xl font-semibold">{data.price.name}</h1>
          <p class="text-muted-foreground mb-6">
            {formatAmount(data.price.unitAmount, data.price.currency)}
          </p>
          <AddToCart price={data.price} />
        </section>
      ` + "\n",
    ),
  ];
}
