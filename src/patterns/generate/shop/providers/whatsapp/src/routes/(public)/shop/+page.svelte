<script lang="ts">
	import AddToCart from '#lib/components/cart/add-to-cart.svelte';
	import { catalog } from '#lib/catalog.js';
	import { formatPrice } from '#lib/order.js';
</script>

<section data-role="content">
	<h1 class="mb-6 text-2xl font-semibold">Shop</h1>

	<ul class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
		{#each catalog as item (item.id)}
			<li class="flex flex-col gap-3 rounded-lg border p-4">
				<a href="/shop/{item.id}" class="flex flex-col gap-3">
					{#if item.image}
						<img src={item.image} alt="" class="aspect-square w-full rounded object-cover" />
					{/if}
					<div>
						<h2 class="font-medium">{item.name}</h2>
						<p class="text-muted-foreground text-sm">
							{#if item.price !== undefined}
								{formatPrice(item.price)}
							{:else}
								Price on request
							{/if}
						</p>
					</div>
				</a>
				<AddToCart id={item.id} name={item.name} price={item.price} class="mt-auto" />
			</li>
		{/each}
	</ul>
</section>
