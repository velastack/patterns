<script lang="ts">
	import { CmsCollection, CmsText, type CollectionItem } from '@velastack/cms';
	import AddToCart from '#lib/components/cart/add-to-cart.svelte';
	import { formatPrice } from '#lib/order.js';

	// The catalog is edited in place: open the page with `?edit` to add items.
	// It lives in the root layout scope, so the product pages read the same
	// list. Prices are in `site.currency` (src/lib/site.ts); an item without
	// one is quoted in the chat.
	const sample: Partial<CollectionItem>[] = [
		{
			id: 'concha',
			title: 'Concha',
			summary: 'A sweet bun with a vanilla or cocoa shell.',
			price: { amount: 12, currency: '', period: '', prefix: '' }
		},
		{
			id: 'birthday-cake',
			title: 'Birthday cake',
			summary: 'Say the size and the day you need it in the chat.'
		}
	];
</script>

<section data-role="content">
	<h1 class="mb-6 text-2xl font-semibold"><CmsText name="title" fallback="Shop" /></h1>

	<CmsCollection name="catalog" scope="root" fallback={sample}>
		{#snippet children(items)}
			<ul class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{#each items as item (item.id)}
					<li class="flex flex-col gap-3 rounded-lg border p-4">
						<a href="/shop/{item.id}" class="flex flex-col gap-3">
							{#if item.image?.url}
								<img src={item.image.url} alt={item.image.alt ?? ''} class="aspect-square w-full rounded object-cover" />
							{/if}
							<div>
								<h2 class="font-medium">{item.title}</h2>
								<p class="text-muted-foreground text-sm">
									{#if item.price.amount !== null}
										{formatPrice(item.price.amount)}
									{:else}
										Price on request
									{/if}
								</p>
							</div>
						</a>
						<AddToCart
							id={item.id}
							name={item.title}
							price={item.price.amount ?? undefined}
							class="mt-auto"
						/>
					</li>
				{/each}
			</ul>
		{/snippet}
	</CmsCollection>
</section>
