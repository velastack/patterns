<script lang="ts">
	import AddToCart from '#lib/components/cart/add-to-cart.svelte';
	import { formatPrice } from '#lib/order.js';

	let { data } = $props();
</script>

<section data-role="content" class="grid gap-8 md:grid-cols-2">
	<div>
		{#if data.item.image}
			<img src={data.item.image} alt="" class="aspect-square w-full rounded-lg object-cover" />
		{/if}
	</div>

	<div class="flex flex-col gap-6">
		<div>
			<p class="text-muted-foreground mb-2 text-sm"><a href="/shop">Shop</a></p>
			<h1 class="text-2xl font-semibold">{data.item.name}</h1>
			<p class="mt-2 text-lg">
				{#if data.item.price !== undefined}
					{formatPrice(data.item.price)}
				{:else}
					<span class="text-muted-foreground">We'll confirm the price in WhatsApp.</span>
				{/if}
			</p>
		</div>

		{#if data.item.description}
			<p class="text-muted-foreground">{data.item.description}</p>
		{/if}

		<AddToCart id={data.item.id} name={data.item.name} price={data.item.price} size="lg" />
	</div>
</section>
