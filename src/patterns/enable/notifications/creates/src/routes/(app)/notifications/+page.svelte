<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';

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
			<Card.Content class="py-12 text-center text-sm text-muted-foreground">
				You don't have any notifications yet.
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="flex flex-col gap-2">
			{#each data.items as item (item.id)}
				<Card.Root class={item.read ? 'opacity-60' : ''}>
					<Card.Content class="flex items-start justify-between gap-4 py-4">
						<div class="flex flex-col gap-1">
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
								<span class="text-xs text-muted-foreground">
									{new Date(item.created).toLocaleString()}
								</span>
							{/if}
						</div>
						{#if !item.read}
							<form method="post" action="?/markRead" use:enhance>
								<input type="hidden" name="id" value={item.id} />
								<Button type="submit" variant="ghost" size="sm">Mark read</Button>
							</form>
						{/if}
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>
