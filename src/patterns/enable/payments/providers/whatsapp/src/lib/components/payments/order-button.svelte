<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { formToken, orderRef, orderSubtotal, type OrderLine } from '@velastack/whatsapp';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import type { ButtonProps } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import CustomerFields from './customer-fields.svelte';
	import { ORDER_FORM, placeOrder } from '#lib/order.js';
	import { site } from '#lib/site.js';

	interface Props {
		/** What is being ordered, as the business will read it. */
		name: string;
		/** The unit price in `site.currency`, written as you would (`4.5`). Leave it out to quote in the chat. */
		price?: number;
		quantity?: number;
		label?: string;
	}

	let {
		name,
		price,
		quantity = 1,
		label = 'Order on WhatsApp',
		...rest
	}: Props & ButtonProps = $props();

	let open = $state(false);
	let placed = $state<{ ref: string; href: string } | null>(null);
	// Fetched once, the first time the dialog opens: the hosted form refuses
	// a token younger than two seconds, and filling the form in takes longer.
	let token: string | null = null;

	$effect(() => {
		if (!open || !ORDER_FORM || token) return;
		formToken(ORDER_FORM).then((value) => (token = value));
	});

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const data = new FormData(event.currentTarget as HTMLFormElement);
		const lines: OrderLine[] = [{ name, quantity, price }];
		const order = {
			ref: orderRef(),
			name: String(data.get('name') ?? ''),
			phone: String(data.get('phone') ?? ''),
			note: String(data.get('note') ?? '') || undefined,
			currency: site.currency,
			lines,
			subtotal: orderSubtotal(lines, site.currency)
		};
		const href = placeOrder(order, { token, gotcha: String(data.get('_gotcha') ?? '') });
		if (!href) {
			toast.error('WhatsApp ordering is not set up yet');
			return;
		}
		placed = { ref: order.ref, href };
	}

	function close() {
		open = false;
		placed = null;
	}
</script>

<Button onclick={() => (open = true)} {...rest}>{label}</Button>

<Dialog.Root bind:open onOpenChange={(value) => !value && close()}>
	<Dialog.Content class="sm:max-w-md">
		{#if placed}
			<Dialog.Header>
				<Dialog.Title>Order {placed.ref} opened in WhatsApp</Dialog.Title>
				<Dialog.Description>
					Send the message in WhatsApp to place your order. We'll reply there.
				</Dialog.Description>
			</Dialog.Header>
			<Dialog.Footer>
				<a
					href={placed.href}
					target="_blank"
					rel="noopener noreferrer"
					class={buttonVariants({ variant: 'outline' })}
				>
					Open WhatsApp again
				</a>
				<Button onclick={close}>Done</Button>
			</Dialog.Footer>
		{:else}
			<form class="grid gap-4" onsubmit={submit}>
				<Dialog.Header>
					<Dialog.Title>Order {name}</Dialog.Title>
					<Dialog.Description>
						Your order opens in WhatsApp, ready to send.
					</Dialog.Description>
				</Dialog.Header>
				<CustomerFields />
				<Dialog.Footer>
					<Button type="submit">Continue in WhatsApp</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
