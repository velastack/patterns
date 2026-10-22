<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import type { ButtonProps } from '#lib/components/ui/button/index.js';
	import { cart } from '#lib/cart.svelte.js';

	interface Props {
		/** Your own id for the item (a slug or SKU); adding it again raises the quantity. */
		id: string;
		/** What the business will read in the order. */
		name: string;
		/** The unit price, written as you would (`4.5`). Leave it out to quote in the chat. */
		price?: number;
		/** ISO 4217, e.g. `EUR`; needed with `price`. */
		currency?: string;
		quantity?: number;
		label?: string;
	}

	let {
		id,
		name,
		price,
		currency,
		quantity = 1,
		label = 'Add to cart',
		...rest
	}: Props & ButtonProps = $props();

	let added = $state(false);

	function add() {
		cart.add({ id, name, price, currency }, quantity);
		added = true;
		cart.open = true;
		setTimeout(() => (added = false), 1500);
	}
</script>

<Button onclick={add} {...rest}>
	{added ? 'Added' : label}
</Button>
