<script lang="ts">
	import type {
		Stripe,
		StripeElements,
		StripePaymentElement,
		StripeElementsOptionsMode
	} from '@stripe/stripe-js';
	import { mode as modeWatcher } from 'mode-watcher';
	import { TERMS_AUTO, TERMS_NEVER } from './stripe-constants';
	import { onMount } from 'svelte';

	interface Props {
		stripe: Stripe;
		mode: 'payment' | 'setup';
		amount?: number;
		currency?: string;
		savePaymentMethod?: boolean;
		user?: { email: string; name: string } | null;
		onchange: (complete: boolean) => void;
	}

	let {
		stripe,
		mode,
		amount = 0,
		currency = 'usd',
		savePaymentMethod = false,
		user,
		onchange
	}: Props = $props();

	let cardContainer = $state<HTMLDivElement | null>(null);
	let elements = $state<StripeElements | null>(null);
	let paymentElement = $state<StripePaymentElement | null>(null);

	function initializeElements() {
		if (!stripe) return;

		// Clean up previous elements
		if (paymentElement) {
			paymentElement.destroy();
			paymentElement = null;
		}

		const appearance = {
			theme: modeWatcher.current === 'dark' ? ('night' as const) : ('stripe' as const),
			inputs: 'condensed' as const,
			labels: 'floating' as const
		};

		elements = stripe.elements({
			mode,
			appearance,
			currency,
			...(mode === 'payment' && {
				amount: amount
			}),
			...(user || mode === 'setup'
				? {
						setupFutureUsage: 'off_session' as const
					}
				: {})
		} as StripeElementsOptionsMode);

		paymentElement = elements.create('payment', {
			layout: 'tabs',
			defaultValues: {
				billingDetails: {
					email: user?.email,
					name: user?.name
				}
			},
			terms: savePaymentMethod ? TERMS_AUTO : TERMS_NEVER
		});

		if (cardContainer && paymentElement) {
			paymentElement.mount(cardContainer);
			paymentElement.on('change', (event: any) => {
				onchange(event.complete);
			});
		}
	}

	// Initialize elements when component mounts
	onMount(() => {
		initializeElements();

		return () => {
			if (paymentElement) {
				paymentElement.destroy();
			}
		};
	});

	// Update terms when savePaymentMethod changes
	$effect(() => {
		if (paymentElement) {
			paymentElement.update({
				terms: savePaymentMethod ? TERMS_AUTO : TERMS_NEVER
			});
		}
	});

	export function getElements() {
		return elements;
	}
</script>

<div bind:this={cardContainer}></div>
