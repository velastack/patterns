<script lang="ts">
	import CartItems from '#lib/components/cart/cart-items.svelte';

	let { form } = $props();
</script>

<section data-role="content" class="max-w-xl">
	<h1 class="mb-6 text-2xl font-semibold">Cart</h1>
	{#if form?.message}
		<p class="text-destructive mb-4 text-sm">{form.message}</p>
	{/if}
	<CartItems />
</section>
