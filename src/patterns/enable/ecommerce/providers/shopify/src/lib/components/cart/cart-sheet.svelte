<script lang="ts">
	import MinusIcon from '@lucide/svelte/icons/minus';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import { cart, formatMoney } from '#lib/cart.svelte.js';
	import { currency } from '#lib/currency.svelte.js';

	// A cart is priced in the market for the currency the visitor reads prices in.
	$effect(() => {
		void cart.market(currency.current);
	});
</script>

<Sheet.Root bind:open={cart.open}>
	<Sheet.Content side="right" class="flex flex-col">
		<Sheet.Header>
			<Sheet.Title>Cart</Sheet.Title>
		</Sheet.Header>

		<div class="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
			{#if cart.error}
				<p class="text-destructive text-sm">{cart.error}</p>
			{/if}

			{#if cart.lines.length === 0}
				<p class="text-muted-foreground text-sm">Your cart is empty.</p>
			{:else}
				<ul class="divide-y">
					{#each cart.lines as line (line.id)}
						<li class="flex items-center gap-3 py-3">
							{#if line.merchandise.image}
								<img
									src={line.merchandise.image.url}
									alt={line.merchandise.image.altText ?? line.merchandise.product.title}
									class="size-12 rounded object-cover"
								/>
							{/if}
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium">{line.merchandise.product.title}</p>
								{#if line.merchandise.title !== 'Default Title'}
									<p class="text-muted-foreground truncate text-xs">{line.merchandise.title}</p>
								{/if}
								<p class="text-muted-foreground text-sm">
									{formatMoney(line.cost.totalAmount)}
								</p>
							</div>
							<div class="flex items-center gap-1">
								<Button
									variant="outline"
									size="icon"
									class="size-7"
									aria-label="One fewer {line.merchandise.product.title}"
									disabled={cart.pending}
									onclick={() => cart.setQuantity(line.id, line.quantity - 1)}
								>
									<MinusIcon />
								</Button>
								<span class="w-6 text-center text-sm tabular-nums">{line.quantity}</span>
								<Button
									variant="outline"
									size="icon"
									class="size-7"
									aria-label="One more {line.merchandise.product.title}"
									disabled={cart.pending}
									onclick={() => cart.setQuantity(line.id, line.quantity + 1)}
								>
									<PlusIcon />
								</Button>
							</div>
							<Button
								variant="ghost"
								size="icon"
								class="size-7"
								aria-label="Remove {line.merchandise.product.title}"
								disabled={cart.pending}
								onclick={() => cart.remove(line.id)}
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
						<span>{formatMoney(cart.subtotal)}</span>
					</div>
				{/if}

				<!-- Shopify's checkout takes it from here. -->
				<Button href={cart.checkoutUrl ?? undefined} class="w-full" disabled={cart.pending}>
					Check out
				</Button>
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>
