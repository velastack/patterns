<script lang="ts">
	import { onMount } from 'svelte';
	import { cart, formatAmount } from '#lib/cart.svelte.js';

	let { data } = $props();

	onMount(() => {
		cart.load();
		if (data.paid) cart.clear();
	});
</script>

<section data-role="content" class="max-w-xl">
	{#if data.paid}
		<h1 class="mb-2 text-2xl font-semibold">Thank you</h1>
		<p class="text-muted-foreground">
			{#if data.amountTotal !== null && data.currency}
				Your payment of {formatAmount(data.amountTotal, data.currency, data.locale)} went through.
			{:else}
				Your payment went through.
			{/if}
		</p>
	{:else}
		<h1 class="mb-2 text-2xl font-semibold">Payment pending</h1>
		<p class="text-muted-foreground">Your order is placed; the payment has not cleared yet.</p>
	{/if}
</section>
