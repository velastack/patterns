<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import type { ButtonProps } from '#lib/components/ui/button/index.js';
	import { cart } from '#lib/cart.svelte.js';

	interface Props {
		/** The product variant: `gid://shopify/ProductVariant/...`. */
		merchandiseId: string;
		quantity?: number;
		/** Line item properties Shopify keeps with the line, such as an engraving. */
		attributes?: { key: string; value: string }[];
		label?: string;
	}

	let {
		merchandiseId,
		quantity = 1,
		attributes,
		label = 'Add to cart',
		disabled,
		...rest
	}: Props & ButtonProps = $props();

	let added = $state(false);

	async function add() {
		await cart.add(merchandiseId, quantity, attributes);
		if (cart.error) return;
		added = true;
		cart.open = true;
		setTimeout(() => (added = false), 1500);
	}
</script>

<Button onclick={add} disabled={disabled || cart.pending} {...rest}>
	{added ? 'Added' : label}
</Button>
