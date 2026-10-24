<script lang="ts">
	import * as Card from '#lib/components/ui/card/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import { formatAmount } from '#lib/cart.svelte.js';

	let { data } = $props();

	const when = new Date(data.order.created).toLocaleDateString(undefined, { dateStyle: 'long' });
</script>

<div class="flex flex-col gap-6">
	<div>
		<p class="text-muted-foreground mb-2 text-sm"><a href="/orders">Orders</a></p>
		<h1 class="text-2xl font-semibold">Order of {when}</h1>
		<p class="text-muted-foreground text-xs">{data.order.id}</p>
	</div>

	<Card.Root>
		<Card.Header class="flex flex-row items-center justify-between">
			<Card.Title>Items</Card.Title>
			<Badge variant={data.order.status === 'paid' ? 'default' : 'secondary'}>
				{data.order.status === 'paid' ? 'Paid' : 'Pending'}
			</Badge>
		</Card.Header>
		<Card.Content class="flex flex-col gap-4">
			<ul class="divide-y">
				{#each data.lines as line (line.id)}
					<li class="flex items-center justify-between gap-4 py-3">
						<div class="flex flex-col">
							<span class="font-medium">{line.name}</span>
							{#if line.unitAmount !== null}
								<span class="text-muted-foreground text-sm">
									{line.quantity} × {formatAmount(line.unitAmount, line.currency)}
								</span>
							{/if}
						</div>
						<span>{formatAmount(line.amountTotal, line.currency)}</span>
					</li>
				{/each}
			</ul>
			<Separator />
			<div class="flex justify-between font-medium">
				<span>Total</span>
				<span>{formatAmount(data.order.amountTotal, data.order.currency)}</span>
			</div>
		</Card.Content>
	</Card.Root>
</div>
