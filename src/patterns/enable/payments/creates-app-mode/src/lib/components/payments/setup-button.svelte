<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import SetupDialog from '$lib/components/payments/setup-dialog.svelte';
	import { useStripe } from '$lib/components/payments/use-stripe.svelte';
	import { usePaymentIntent } from '$lib/components/payments/use-payment-intent.svelte';

	interface Props {
		disabled?: boolean;
		isProcessing?: boolean;
		label?: string;
		processingLabel?: string;
		onsuccess?: () => void;
	}

	let {
		disabled = false,
		isProcessing = false,
		label,
		processingLabel,
		onsuccess
	}: Props = $props();

	const stripeManager = useStripe();
	const paymentIntentManager = usePaymentIntent();

	let showDialog = $state(false);
	let clientSecret = $state<string>();

	async function handleSetupClick() {
		const result = await paymentIntentManager.fetchSetupIntent();

		if (!result) return;

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

<Button disabled={disabled || isProcessing} onclick={handleSetupClick}>
	{#if isProcessing}
		{processingLabel}
	{:else}
		{label}
	{/if}
</Button>

<SetupDialog
	bind:open={showDialog}
	stripe={stripeManager.stripe}
	{clientSecret}
	onopenchange={handleDialogOpenChange}
	onsuccess={handlePaymentSuccess}
/>
