<script lang="ts">
	import { formatMoney } from '#lib/cart.svelte.js';

	let { data } = $props();
</script>

<section data-role="content">
	<h1 class="mb-6 text-2xl font-semibold">Shop</h1>

	{#if data.products.length === 0}
		<p class="text-muted-foreground">
			Nothing for sale yet. Products live in Shopify admin; publish them to the Headless channel
			the Storefront token belongs to.
		</p>
	{:else}
		<ul class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.products as product (product.id)}
				<li class="rounded-lg border p-4">
					<a href="/shop/{product.handle}" class="flex flex-col gap-3">
						{#if product.featuredImage}
							<img
								src={product.featuredImage.url}
								alt={product.featuredImage.altText ?? ''}
								class="aspect-square w-full rounded object-cover"
							/>
						{/if}
						<div>
							<h2 class="font-medium">{product.title}</h2>
							<p class="text-muted-foreground text-sm">
								From {formatMoney(product.priceRange.minVariantPrice)}
							</p>
						</div>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>
