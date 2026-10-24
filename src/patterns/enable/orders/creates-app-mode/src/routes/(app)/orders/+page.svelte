<script lang="ts">
	import * as Card from '#lib/components/ui/card/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { formatAmount } from '#lib/cart.svelte.js';

	let { data } = $props();

	const when = (iso: string) =>
		new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
</script>

<div class="flex flex-col gap-6">
	<div>
		<h1 class="text-2xl font-semibold">Orders</h1>
		<p class="text-muted-foreground text-sm">What you have bought here.</p>
	</div>

	{#if data.orders.length === 0}
		<p class="text-muted-foreground text-sm">No orders yet.</p>
	{:else}
		<Card.Root>
			<Card.Content class="p-0">
				<ul class="divide-y">
					{#each data.orders as order (order.id)}
						<li>
							<a
								href="/orders/{order.id}"
								class="hover:bg-muted/50 flex items-center justify-between gap-4 px-6 py-4"
							>
								<div class="flex flex-col">
									<span class="font-medium">{when(order.created)}</span>
									<span class="text-muted-foreground text-xs">{order.id}</span>
								</div>
								<div class="flex items-center gap-3">
									<Badge variant={order.status === 'paid' ? 'default' : 'secondary'}>
										{order.status === 'paid' ? 'Paid' : 'Pending'}
									</Badge>
									<span class="font-medium">{formatAmount(order.amountTotal, order.currency)}</span>
								</div>
							</a>
						</li>
					{/each}
				</ul>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
