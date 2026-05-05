<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import BellIcon from '@lucide/svelte/icons/bell';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';

	interface NotificationItem {
		id: string;
		title: string;
		body: string;
		read: boolean;
		created: string;
	}

	const POLL_MS = 30_000;

	let count = $state(0);
	let items = $state<NotificationItem[]>([]);
	let lastSeenId = $state<string | null>(null);
	let firstLoad = true;

	async function tick() {
		if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
		try {
			const res = await fetch('/api/notifications');
			if (!res.ok) return;
			const data = (await res.json()) as { count: number; items: NotificationItem[] };
			const previousId = lastSeenId;
			count = data.count;
			items = data.items;

			const newest = data.items[0]?.id ?? null;
			if (!firstLoad && newest && newest !== previousId) {
				for (const item of data.items) {
					if (previousId && item.id <= previousId) break;
					toast.info(item.title, {
						description: item.body || undefined,
						action: { label: 'View', onClick: () => goto('/notifications') }
					});
				}
			}
			lastSeenId = newest;
			firstLoad = false;
		} catch {
			// Network blips: leave state as-is until next tick.
		}
	}

	onMount(() => {
		tick();
		const id = setInterval(tick, POLL_MS);
		const onVisible = () => {
			if (document.visibilityState === 'visible') tick();
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			clearInterval(id);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});

	const badgeText = $derived(count > 99 ? '99+' : String(count));
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button variant="ghost" size="icon" class="relative" aria-label="Notifications" {...props}>
				<BellIcon class="size-5" />
				{#if count > 0}
					<Badge
						variant="destructive"
						class="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] leading-none"
					>
						{badgeText}
					</Badge>
				{/if}
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" class="w-80">
		<DropdownMenu.Label>Notifications</DropdownMenu.Label>
		<DropdownMenu.Separator />
		{#if items.length === 0}
			<div class="px-2 py-6 text-center text-sm text-muted-foreground">
				You're all caught up.
			</div>
		{:else}
			{#each items as item (item.id)}
				<DropdownMenu.Item class="p-0">
					<a
						href="/notifications"
						class="flex w-full flex-col gap-1 px-2 py-2 cursor-default"
					>
						<span class="text-sm font-medium">{item.title}</span>
						{#if item.body}
							<span class="text-xs text-muted-foreground line-clamp-2">{item.body}</span>
						{/if}
					</a>
				</DropdownMenu.Item>
			{/each}
		{/if}
		<DropdownMenu.Separator />
		<DropdownMenu.Item class="p-0">
			<a href="/notifications" class="flex w-full justify-center px-2 py-1.5 text-sm cursor-default">
				View all
			</a>
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
