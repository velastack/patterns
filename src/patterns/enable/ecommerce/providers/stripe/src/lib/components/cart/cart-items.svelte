<script lang="ts">
	import MinusIcon from '@lucide/svelte/icons/minus';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import { cart, formatAmount } from '#lib/cart.svelte.js';

	let { class: className = '' }: { class?: string } = $props();

	// What the checkout action reads: the prices and quantities, nothing the
	// browser could misstate.
	const items = $derived(
		JSON.stringify(cart.items.map(({ price, quantity }) => ({ price, quantity })))
	);
</script>

<div class="flex flex-col gap-4 {className}">
	{#if cart.items.length === 0}
		<p class="text-muted-foreground text-sm">Your cart is empty.</p>
	{:else}
		<ul class="divide-y">
			{#each cart.items as item (item.price)}
				<li class="flex items-center gap-3 py-3">
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium">{item.name}</p>
						<p class="text-muted-foreground text-sm">
							{formatAmount(item.unitAmount, item.currency)}
						</p>
					</div>
					<div class="flex items-center gap-1">
						<Button
							variant="outline"
							size="icon"
							class="size-7"
							aria-label="One fewer {item.name}"
							onclick={() => cart.setQuantity(item.price, item.quantity - 1)}
						>
							<MinusIcon />
						</Button>
						<span class="w-6 text-center text-sm tabular-nums">{item.quantity}</span>
						<Button
							variant="outline"
							size="icon"
							class="size-7"
							aria-label="One more {item.name}"
							onclick={() => cart.setQuantity(item.price, item.quantity + 1)}
						>
							<PlusIcon />
						</Button>
					</div>
					<Button
						variant="ghost"
						size="icon"
						class="size-7"
						aria-label="Remove {item.name}"
						onclick={() => cart.remove(item.price)}
					>
						<XIcon />
					</Button>
				</li>
			{/each}
		</ul>

		<Separator />

		{#if cart.currency}
			<div class="flex justify-between text-sm font-medium">
				<span>Subtotal</span>
				<span>{formatAmount(cart.subtotal, cart.currency)}</span>
			</div>
		{/if}

		<!-- A plain form post: checkout works before the page has hydrated. -->
		<form method="POST" action="/cart?/checkout">
			<input type="hidden" name="items" value={items} />
			<Button type="submit" class="w-full">Check out</Button>
		</form>
	{/if}
</div>
