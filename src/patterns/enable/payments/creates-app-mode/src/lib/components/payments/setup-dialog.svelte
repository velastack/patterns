<script lang="ts">
	import type { Stripe, StripeElements } from '@stripe/stripe-js';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { toast } from 'svelte-sonner';
	import { page } from '$app/state';
	import { invalidate } from '$app/navigation';
	import StripePaymentForm from './stripe-payment-form.svelte';

	interface Props {
		stripe: Stripe | null;
		open: boolean;
		clientSecret?: string;
		onopenchange: (open: boolean) => void;
		onsuccess: () => void;
	}

	let { stripe, open = $bindable(), clientSecret, onopenchange, onsuccess }: Props = $props();

	let isProcessing = $state(false);
	let cardComplete = $state(false);
	let formRef = $state<{
		getElements: () => StripeElements | null;
	}>();

	const handleOpenChangeComplete = (isOpen: boolean) => {
		if (!isOpen) {
			resetDialog();
		}
		onopenchange(isOpen);
	};

	function resetDialog() {
		open = false;
		isProcessing = false;
		cardComplete = false;
	}

	function handleCardChange(complete: boolean) {
		cardComplete = complete;
	}

	async function handleSetupPaymentMethod() {
		if (!stripe || !formRef || !cardComplete || !clientSecret) return;

		const elements = formRef.getElements();
		if (!elements) return;

		isProcessing = true;

		try {
			const { error: submitError } = await elements.submit();
			if (submitError) {
				toast.error(submitError.message || 'Failed to add payment method');
				return;
			}

			const { error: confirmError } = await stripe.confirmSetup({
				elements,
				clientSecret,
				confirmParams: {
					return_url: page.url.toString(),
					payment_method_data: {
						allow_redisplay: 'always'
					}
				},
				redirect: 'if_required'
			});

			if (confirmError) {
				toast.error(confirmError.message || 'Failed to add payment method');
				return;
			}

			await invalidate('app:billing');
			toast.success('Payment method added successfully');
			onsuccess();
			resetDialog();
		} catch (err) {
			console.error('Error adding payment method:', err);
			toast.error('Failed to add payment method');
		} finally {
			isProcessing = false;
		}
	}
</script>

<Dialog.Root bind:open onOpenChangeComplete={handleOpenChangeComplete}>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title>Add payment method</Dialog.Title>
			<Dialog.Description>Enter your card details to add a new payment method.</Dialog.Description>
		</Dialog.Header>
		<div>
			{#if stripe && open}
				<StripePaymentForm
					bind:this={formRef}
					mode="setup"
					{stripe}
					onchange={handleCardChange}
					savePaymentMethod={true}
				/>
			{/if}
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={resetDialog} disabled={isProcessing}>Cancel</Button>
			<Button onclick={handleSetupPaymentMethod} disabled={!cardComplete || isProcessing}>
				{isProcessing ? 'Processing...' : 'Add Card'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
