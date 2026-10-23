<script lang="ts">
	import { page } from '$app/state';
	import { CmsCollection } from '@velastack/cms';
	import AddToCart from '#lib/components/cart/add-to-cart.svelte';
	import { formatPrice } from '#lib/currency.svelte.js';
</script>

<!-- The same catalog the shop page edits, from the root layout scope. -->
<CmsCollection name="catalog" scope="root">
	{#snippet children(items)}
		{@const item = items.find((candidate) => candidate.id === page.params.id)}
		<section data-role="content" class="grid gap-8 md:grid-cols-2">
			{#if item}
				<div>
					{#if item.image?.url}
						<img src={item.image.url} alt={item.image.alt ?? ''} class="aspect-square w-full rounded-lg object-cover" />
					{/if}
				</div>

				<div class="flex flex-col gap-6">
					<div>
						<p class="text-muted-foreground mb-2 text-sm"><a href="/shop">Shop</a></p>
						<h1 class="text-2xl font-semibold">{item.title}</h1>
						<p class="mt-2 text-lg">
							{#if item.price.amount !== null}
								{formatPrice(item.price.amount)}
							{:else}
								<span class="text-muted-foreground">We'll confirm the price in WhatsApp.</span>
							{/if}
						</p>
					</div>

					{#if item.summary}
						<p class="text-muted-foreground">{item.summary}</p>
					{/if}

					<AddToCart id={item.id} name={item.title} price={item.price.amount ?? undefined} size="lg" />
				</div>
			{:else}
				<div>
					<h1 class="text-2xl font-semibold">Not found</h1>
					<p class="text-muted-foreground mt-2"><a href="/shop">Back to the shop</a></p>
				</div>
			{/if}
		</section>
	{/snippet}
</CmsCollection>
