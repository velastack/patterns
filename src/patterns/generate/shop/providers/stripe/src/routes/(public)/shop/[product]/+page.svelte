<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import AddToCart from '#lib/components/cart/add-to-cart.svelte';
	import { formatAmount } from '#lib/cart.svelte.js';

	let { data } = $props();

	// The default price first, or the cheapest; with one price there is nothing to pick.
	let selectedId = $state(
		data.prices.find((price) => price.price === data.product.defaultPrice)?.price ??
			data.prices[0].price
	);
	const selected = $derived(data.prices.find((price) => price.price === selectedId) ?? data.prices[0]);
</script>

<section data-role="content" class="grid gap-8 md:grid-cols-2">
	<div class="flex flex-col gap-3">
		{#each data.product.images.slice(0, 1) as image (image)}
			<img src={image} alt="" class="aspect-square w-full rounded-lg object-cover" />
		{/each}
	</div>

	<div class="flex flex-col gap-6">
		<div>
			<p class="text-muted-foreground mb-2 text-sm"><a href="/shop">Shop</a></p>
			<h1 class="text-2xl font-semibold">{data.product.name}</h1>
			<p class="mt-2 text-lg">
				{formatAmount(selected.unitAmount, selected.currency, selected.options)}
			</p>
		</div>

		{#if data.product.description}
			<p class="text-muted-foreground">{data.product.description}</p>
		{/if}

		{#if data.prices.length > 1}
			<div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Option">
				{#each data.prices as price (price.price)}
					<Button
						variant={price.price === selectedId ? 'default' : 'outline'}
						size="sm"
						role="radio"
						aria-checked={price.price === selectedId}
						onclick={() => (selectedId = price.price)}
					>
						{price.nickname ?? formatAmount(price.unitAmount, price.currency, price.options)}
					</Button>
				{/each}
			</div>
		{/if}

		<AddToCart price={selected} size="lg" />
	</div>
</section>
