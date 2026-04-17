<script lang="ts">
	import type { Stripe, StripeElements } from '@stripe/stripe-js';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { toast } from 'svelte-sonner';
	import { page } from '$app/state';
	import { invalidate } from '$app/navigation';
	import StripePaymentForm from './stripe-payment-form.svelte';

	interface Props {
		stripe: Stripe | null;
		open: boolean;
		amount: number;
		currency: string;
		clientSecret?: string;
		user?: { email: string; name: string } | null;
		onopenchange: (open: boolean) => void;
		onsuccess: () => void;
	}

	let {
		stripe,
		open = $bindable(),
		amount,
		currency,
		clientSecret,
		user = null,
		onopenchange,
		onsuccess
	}: Props = $props();

	let isProcessing = $state(false);
	let cardComplete = $state(false);
	let savePaymentMethod = $state(false);
	let email = $state<string>();
	let formRef = $state<{
		getElements: () => StripeElements | null;
	}>();

	let amountFormatted = $derived.by(() => {
		let formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency });
		return formatter.format(amount / 100);
	});

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

	async function handlePaymentMethod() {
		if (!stripe || !formRef || !cardComplete || !clientSecret) return;

		const elements = formRef.getElements();
		if (!elements) return;

		isProcessing = true;

		try {
			const { error: submitError } = await elements.submit();
			if (submitError) {
				toast.error(submitError.message || 'Failed to pay for your purchase');
				return;
			}

			const { error: confirmError } = await stripe.confirmPayment({
				elements,
				clientSecret,
				confirmParams: {
					return_url: page.url.toString(),
					payment_method_data: {
						billing_details: {
							email: email || user?.email
						},
						allow_redisplay: savePaymentMethod ? 'always' : 'unspecified'
					}
				},
				redirect: 'if_required'
			});

			if (confirmError) {
				toast.error(confirmError.message || 'Failed to pay for your purchase');
				return;
			}

			await invalidate('app:billing');
			toast.success('Payment successful');
			onsuccess();
			resetDialog();
		} catch (err) {
			console.error('Error paying for your purchase:', err);
			toast.error('Failed to pay for your purchase');
		} finally {
			isProcessing = false;
		}
	}
</script>

<Dialog.Root bind:open onOpenChangeComplete={handleOpenChangeComplete}>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title>{amountFormatted}</Dialog.Title>
			<Dialog.Description>Enter your card details to pay for your purchase.</Dialog.Description>
		</Dialog.Header>
		{#if !user}
			<div class="space-y-2">
				<Label for="email">Email</Label>
				<Input type="email" bind:value={email} />
			</div>
		{/if}
		<div>
			{#if stripe && open}
				<StripePaymentForm
					bind:this={formRef}
					mode="payment"
					{stripe}
					{amount}
					{currency}
					{savePaymentMethod}
					{user}
					onchange={handleCardChange}
				/>
			{/if}
		</div>
		{#if user}
			<div class="flex items-center gap-2">
				<input type="checkbox" id="savePaymentMethod" bind:checked={savePaymentMethod} />
				<label for="savePaymentMethod" class="text-sm text-muted-foreground">
					Save payment method for future purchases
				</label>
			</div>
		{/if}
		<Dialog.Footer>
			<Button variant="outline" onclick={resetDialog} disabled={isProcessing}>Cancel</Button>
			<Button onclick={handlePaymentMethod} disabled={!cardComplete || isProcessing}>
				{isProcessing ? 'Processing...' : 'Pay Now'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
