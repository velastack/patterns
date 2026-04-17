<script lang="ts">
	import type { Stripe } from '@stripe/stripe-js';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { toast } from 'svelte-sonner';
	import { page } from '$app/state';
	import { invalidate } from '$app/navigation';

	interface Props {
		stripe: Stripe | null;
		open: boolean;
		amount: number;
		currency: string;
		brand?: string;
		last4?: string;
		clientSecret?: string;
		onopenchange: (open: boolean) => void;
		onsuccess: () => void;
	}

	let {
		stripe,
		open = $bindable(),
		amount,
		currency,
		brand,
		last4,
		clientSecret,
		onopenchange,
		onsuccess
	}: Props = $props();

	const brandNames = {
		amex: 'American Express',
		cartes_bancaires: 'Cartes Bancaires',
		diners: 'Diners',
		discover: 'Discover',
		eftpos_au: 'Eftpos Au',
		jcb: 'Jcb',
		link: 'Link',
		mastercard: 'Mastercard',
		unionpay: 'Unionpay',
		visa: 'Visa',
		unknown: 'Unknown'
	};

	let isProcessing = $state(false);

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
	}

	async function handlePaymentMethod() {
		if (!stripe || !clientSecret) return;

		isProcessing = true;

		try {
			const { error: confirmError } = await stripe.confirmPayment({
				clientSecret,
				confirmParams: {
					return_url: page.url.toString()
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
			<Dialog.Title>Confirm payment</Dialog.Title>
			<Dialog.Description>
				Are you sure you want to pay {amountFormatted} with your
				{brandNames[brand as keyof typeof brandNames]}
				credit card ending in **** {last4}?
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={resetDialog} disabled={isProcessing}>Cancel</Button>
			<Button onclick={handlePaymentMethod} disabled={isProcessing}>
				{isProcessing ? 'Processing...' : 'Pay Now'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
