<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { ButtonProps } from '#lib/components/ui/button/index.js';
	import { marketCountry, storefront } from '#lib/shopify.js';
	import { currency } from '#lib/currency.svelte.js';

	interface Props {
		/** The product variant to buy: `gid://shopify/ProductVariant/...`. */
		variantId: string;
		quantity?: number;
		label?: string;
		processingLabel?: string;
	}

	let {
		variantId,
		quantity = 1,
		label = 'Buy now',
		processingLabel = 'Redirecting...',
		disabled,
		...rest
	}: Props & ButtonProps = $props();

	const CART_CREATE = `#graphql
		mutation BuyNow($lines: [CartLineInput!]!, $country: CountryCode) @inContext(country: $country) {
			cartCreate(input: { lines: $lines, buyerIdentity: { countryCode: $country } }) {
				cart {
					checkoutUrl
				}
				userErrors {
					message
				}
			}
		}
	`;

	let isProcessing = $state(false);

	// A one-line cart in the visitor's market, then Shopify's checkout for it.
	async function buy() {
		isProcessing = true;
		try {
			const country = await marketCountry(currency.current);
			const { data, errors } = await storefront().request(CART_CREATE, {
				variables: { lines: [{ merchandiseId: variantId, quantity }], country }
			});
			const checkoutUrl = data?.cartCreate?.cart?.checkoutUrl;
			if (errors || !checkoutUrl) {
				throw new Error(
					data?.cartCreate?.userErrors?.[0]?.message ?? errors?.message ?? 'No checkout URL'
				);
			}
			window.location.assign(checkoutUrl);
		} catch (error) {
			console.error('Shopify checkout failed:', error);
			toast.error('Could not start checkout');
			isProcessing = false;
		}
	}
</script>

<Button disabled={disabled || isProcessing} onclick={buy} {...rest}>
	{#if isProcessing}
		{processingLabel}
	{:else}
		{label}
	{/if}
</Button>
