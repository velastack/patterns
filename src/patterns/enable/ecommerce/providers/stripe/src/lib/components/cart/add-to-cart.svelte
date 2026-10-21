<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import type { ButtonProps } from '#lib/components/ui/button/index.js';
	import { cart, type CartItem } from '#lib/cart.svelte.js';

	interface Props {
		/** The Stripe price, as the page selling it loaded it. */
		price: Omit<CartItem, 'quantity'>;
		quantity?: number;
		label?: string;
	}

	let { price, quantity = 1, label = 'Add to cart', ...rest }: Props & ButtonProps = $props();

	let added = $state(false);

	function add() {
		cart.add(price, quantity);
		added = true;
		cart.open = true;
		setTimeout(() => (added = false), 1500);
	}
</script>

<Button onclick={add} {...rest}>
	{added ? 'Added' : label}
</Button>
