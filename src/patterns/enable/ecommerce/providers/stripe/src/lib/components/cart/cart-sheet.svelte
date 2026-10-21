<script lang="ts">
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import CartItems from './cart-items.svelte';
	import { cart } from '#lib/cart.svelte.js';
</script>

<Sheet.Root bind:open={cart.open}>
	<Sheet.Content side="right" class="flex flex-col">
		<Sheet.Header>
			<Sheet.Title>Cart</Sheet.Title>
		</Sheet.Header>
		<CartItems class="flex-1 overflow-y-auto px-4 pb-4" />
	</Sheet.Content>
</Sheet.Root>
