<script lang="ts">
	import AddToCart from '#lib/components/cart/add-to-cart.svelte';
	import { formatAmount } from '#lib/cart.svelte.js';

	let { data } = $props();
</script>

<section data-role="content">
	<h1 class="mb-6 text-2xl font-semibold">Shop</h1>

	{#if data.products.length === 0}
		<p class="text-muted-foreground">
			Nothing for sale yet. Products and prices come from your Stripe dashboard; the catalog syncs
			every ten minutes.
		</p>
	{:else}
		<ul class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.products as product (product.id)}
				<li class="flex flex-col gap-3 rounded-lg border p-4">
					<a href="/shop/{product.slug}" class="flex flex-col gap-3">
						{#if product.image}
							<img src={product.image} alt="" class="aspect-square w-full rounded object-cover" />
						{/if}
						<div>
							<h2 class="font-medium">{product.name}</h2>
							<p class="text-muted-foreground text-sm">
								{formatAmount(
									product.price.unitAmount,
									product.price.currency,
									product.price.options
								)}
							</p>
						</div>
					</a>
					<AddToCart price={product.price} class="mt-auto" />
				</li>
			{/each}
		</ul>
	{/if}
</section>
