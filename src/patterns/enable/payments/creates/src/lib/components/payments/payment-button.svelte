<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import PaymentDialog from '$lib/components/payments/payment-dialog.svelte';
	import ConfirmDialog from '$lib/components/payments/confirm-dialog.svelte';
	import { useStripe } from '$lib/components/payments/use-stripe.svelte';
	import { usePaymentIntent } from '$lib/components/payments/use-payment-intent.svelte';
	import type { ButtonProps } from '$lib/components/ui/button';

	interface Props {
		priceId: string;
		user?: { email: string; name: string } | null;
		disabled?: boolean;
		isProcessing?: boolean;
		label?: string;
		processingLabel?: string;
		onsuccess?: () => void;
	}

	let {
		priceId,
		user,
		disabled = false,
		isProcessing = false,
		label = 'Purchase',
		processingLabel = 'Processing...',
		onsuccess,
		...rest
	}: Props & ButtonProps = $props();

	const stripeManager = useStripe();
	const paymentIntentManager = usePaymentIntent();

	let mode = $state<'payment' | 'confirm'>('payment');
	let showDialog = $state(false);
	let amount = $state<number>(0);
	let currency = $state<string>('usd');
	let clientSecret = $state<string>();
	let brand = $state<string>();
	let last4 = $state<string>();

	async function handleBuyClick() {
		const result = await paymentIntentManager.fetchPaymentIntent({
			priceId
		});

		if (!result) return;

		if (result.type === 'confirm') {
			mode = 'confirm';
			brand = result.brand;
			last4 = result.last4;
		} else if (result.type === 'payment') {
			mode = 'payment';
		}

		amount = result.amount || 0;
		currency = result.currency || 'usd';
		clientSecret = result.clientSecret;
		showDialog = true;
	}

	function handleDialogOpenChange(open: boolean) {
		showDialog = open;
	}

	function handlePaymentSuccess() {
		onsuccess?.();
	}
</script>

<Button disabled={disabled || isProcessing} onclick={handleBuyClick} {...rest}>
	{#if isProcessing}
		{processingLabel}
	{:else}
		{label}
	{/if}
</Button>

{#if mode === 'confirm'}
	<ConfirmDialog
		bind:open={showDialog}
		stripe={stripeManager.stripe}
		{amount}
		{currency}
		{brand}
		{last4}
		{clientSecret}
		onopenchange={handleDialogOpenChange}
		onsuccess={handlePaymentSuccess}
	/>
{:else if mode === 'payment'}
	<PaymentDialog
		bind:open={showDialog}
		stripe={stripeManager.stripe}
		{amount}
		{currency}
		{clientSecret}
		{user}
		onopenchange={handleDialogOpenChange}
		onsuccess={handlePaymentSuccess}
	/>
{/if}
