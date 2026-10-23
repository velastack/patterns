<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import AddToCart from '#lib/components/cart/add-to-cart.svelte';
	import { formatMoney } from '#lib/cart.svelte.js';

	let { data } = $props();

	// One value per option, starting from the first variant that can be bought.
	// The variant for sale is the one whose options all match.
	const first = data.product.variants.nodes.find((v) => v.availableForSale) ??
		data.product.variants.nodes[0];
	let chosen = $state<Record<string, string>>(
		Object.fromEntries(first.selectedOptions.map((option) => [option.name, option.value]))
	);
	const variant = $derived(
		data.product.variants.nodes.find((candidate) =>
			candidate.selectedOptions.every((option) => chosen[option.name] === option.value)
		)
	);
	// A product with one variant has a single option Shopify calls "Title".
	const options = $derived(
		data.product.options.filter((option) => option.optionValues.length > 1)
	);
</script>

<section data-role="content" class="grid gap-8 md:grid-cols-2">
	<div class="flex flex-col gap-3">
		{#each data.product.images.nodes.slice(0, 1) as image (image.url)}
			<img src={image.url} alt={image.altText ?? ''} class="aspect-square w-full rounded-lg object-cover" />
		{/each}
	</div>

	<div class="flex flex-col gap-6">
		<div>
			<p class="text-muted-foreground mb-2 text-sm"><a href="/shop">Shop</a></p>
			<h1 class="text-2xl font-semibold">{data.product.title}</h1>
			{#if variant}
				<p class="mt-2 text-lg">{formatMoney(variant.price)}</p>
			{/if}
		</div>

		{#each options as option (option.name)}
			<div class="flex flex-col gap-2">
				<p class="text-sm font-medium">{option.name}</p>
				<div class="flex flex-wrap gap-2" role="radiogroup" aria-label={option.name}>
					{#each option.optionValues as value (value.name)}
						<Button
							variant={chosen[option.name] === value.name ? 'default' : 'outline'}
							size="sm"
							role="radio"
							aria-checked={chosen[option.name] === value.name}
							onclick={() => (chosen = { ...chosen, [option.name]: value.name })}
						>
							{value.name}
						</Button>
					{/each}
				</div>
			</div>
		{/each}

		{#if variant}
			<AddToCart
				merchandiseId={variant.id}
				size="lg"
				disabled={!variant.availableForSale}
				label={variant.availableForSale ? 'Add to cart' : 'Sold out'}
			/>
		{:else}
			<p class="text-muted-foreground text-sm">That combination is not available.</p>
		{/if}

		{#if data.product.descriptionHtml}
			<!-- The description as written in Shopify admin, which is HTML. -->
			<div class="prose prose-sm text-muted-foreground">{@html data.product.descriptionHtml}</div>
		{/if}
	</div>
</section>
