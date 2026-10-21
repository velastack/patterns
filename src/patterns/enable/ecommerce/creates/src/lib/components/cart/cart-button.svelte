<script lang="ts">
	import { onMount } from 'svelte';
	import ShoppingCartIcon from '@lucide/svelte/icons/shopping-cart';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { cart } from '#lib/cart.svelte.js';
	import CartSheet from './cart-sheet.svelte';

	// The cart lives in the browser, so the server renders it empty and it
	// fills in here.
	onMount(() => cart.load());
</script>

<Button
	variant="ghost"
	size="icon"
	class="relative"
	aria-label="Cart, {cart.count} items"
	onclick={() => (cart.open = true)}
>
	<ShoppingCartIcon />
	{#if cart.count > 0}
		<Badge class="absolute -top-1 -right-1 h-5 min-w-5 rounded-full px-1 tabular-nums">
			{cart.count}
		</Badge>
	{/if}
</Button>

<CartSheet />
