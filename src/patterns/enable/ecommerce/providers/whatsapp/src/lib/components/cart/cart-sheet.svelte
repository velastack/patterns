<script lang="ts">
	import MinusIcon from '@lucide/svelte/icons/minus';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import { toast } from 'svelte-sonner';
	import { formatMoney, formToken, lineTotal, orderRef } from '@velastack/whatsapp';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import CustomerFields from '#lib/components/payments/customer-fields.svelte';
	import { cart } from '#lib/cart.svelte.js';
	import { ORDER_FORM, placeOrder } from '#lib/order.js';

	// Fetched once, the first time the cart opens: the hosted form refuses a
	// token younger than two seconds, and filling the form in takes longer.
	let token: string | null = null;

	$effect(() => {
		if (!cart.open || !ORDER_FORM || token) return;
		formToken(ORDER_FORM).then((value) => (token = value));
	});

	function checkout(event: SubmitEvent) {
		event.preventDefault();
		const data = new FormData(event.currentTarget as HTMLFormElement);
		const order = {
			ref: orderRef(),
			name: String(data.get('name') ?? ''),
			phone: String(data.get('phone') ?? ''),
			note: String(data.get('note') ?? '') || undefined,
			lines: cart.items.map(({ name, quantity, price, currency }) => ({
				name,
				quantity,
				price,
				currency
			})),
			subtotal: cart.subtotal
		};
		const href = placeOrder(order, { token, gotcha: String(data.get('_gotcha') ?? '') });
		if (!href) {
			toast.error('WhatsApp ordering is not set up yet');
			return;
		}
		cart.place({ ref: order.ref, href });
	}

	function done() {
		cart.clear();
		cart.open = false;
	}
</script>

<Sheet.Root bind:open={cart.open}>
	<Sheet.Content side="right" class="flex flex-col">
		<Sheet.Header>
			<Sheet.Title>Cart</Sheet.Title>
		</Sheet.Header>
		<div class="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
			{#if cart.placed}
				<div class="flex flex-col gap-2">
					<p class="font-medium">Order {cart.placed.ref} opened in WhatsApp</p>
					<p class="text-muted-foreground text-sm">
						Send the message in WhatsApp to place your order. We'll reply there.
					</p>
				</div>
				<a
					href={cart.placed.href}
					target="_blank"
					rel="noopener noreferrer"
					class={buttonVariants({ variant: 'outline' })}
				>
					Open WhatsApp again
				</a>
				<Button onclick={done}>Done</Button>
			{:else if cart.items.length === 0}
				<p class="text-muted-foreground text-sm">Your cart is empty.</p>
			{:else}
				<ul class="divide-y">
					{#each cart.items as item (item.id)}
						{@const total = lineTotal(item)}
						<li class="flex items-center gap-3 py-3">
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium">{item.name}</p>
								{#if total}
									<p class="text-muted-foreground text-sm">
										{formatMoney(total.amount, total.currency)}
									</p>
								{/if}
							</div>
							<div class="flex items-center gap-1">
								<Button
									variant="outline"
									size="icon"
									class="size-7"
									aria-label="One fewer {item.name}"
									onclick={() => cart.setQuantity(item.id, item.quantity - 1)}
								>
									<MinusIcon />
								</Button>
								<span class="w-6 text-center text-sm tabular-nums">{item.quantity}</span>
								<Button
									variant="outline"
									size="icon"
									class="size-7"
									aria-label="One more {item.name}"
									onclick={() => cart.setQuantity(item.id, item.quantity + 1)}
								>
									<PlusIcon />
								</Button>
							</div>
							<Button
								variant="ghost"
								size="icon"
								class="size-7"
								aria-label="Remove {item.name}"
								onclick={() => cart.remove(item.id)}
							>
								<XIcon />
							</Button>
						</li>
					{/each}
				</ul>

				<Separator />

				{#if cart.subtotal}
					<div class="flex justify-between text-sm font-medium">
						<span>Subtotal</span>
						<span>{formatMoney(cart.subtotal.amount, cart.subtotal.currency)}</span>
					</div>
				{:else}
					<p class="text-muted-foreground text-sm">We'll confirm the total in WhatsApp.</p>
				{/if}

				<form class="flex flex-col gap-4" onsubmit={checkout}>
					<CustomerFields />
					<Button type="submit" class="w-full">Order on WhatsApp</Button>
				</form>
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>
