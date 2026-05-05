<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import { timeAgo } from '$lib/utils';

	let { data } = $props();
</script>

<div class="flex flex-col gap-4">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<h1 class="text-2xl font-semibold">Notifications</h1>
			{#if data.unread > 0}
				<Badge variant="secondary">{data.unread} unread</Badge>
			{/if}
		</div>
		{#if data.unread > 0}
			<form method="post" action="?/markAllRead" use:enhance>
				<Button type="submit" variant="outline" size="sm">Mark all read</Button>
			</form>
		{/if}
	</div>

	{#if data.items.length === 0}
		<Card.Root>
			<Card.Content class="py-10 text-center text-sm text-muted-foreground">
				You don't have any notifications yet.
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="flex flex-col gap-2">
			{#each data.items as item (item.id)}
				<Card.Root
					size="sm"
					class={['relative transition-colors', item.read ? 'opacity-70' : '']}
				>
					<Card.Content class="flex items-start justify-between gap-4">
						<div class="flex min-w-0 flex-col gap-0.5">
							<div class="flex items-center gap-2">
								<span class="font-medium">{item.title}</span>
								{#if !item.read}
									<span class="size-2 rounded-full bg-primary" aria-label="unread"></span>
								{/if}
							</div>
							{#if item.body}
								<p class="text-sm text-muted-foreground">{item.body}</p>
							{/if}
							{#if item.created}
								<span
									class="text-xs text-muted-foreground"
									title={new Date(item.created).toLocaleString()}
								>
									{timeAgo(item.created)}
								</span>
							{/if}
						</div>
						{#if !item.read}
							<form method="post" action="?/markRead" use:enhance>
								<input type="hidden" name="id" value={item.id} />
								<Button type="submit" variant="outline" size="sm">Mark read</Button>
							</form>
						{/if}
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>
