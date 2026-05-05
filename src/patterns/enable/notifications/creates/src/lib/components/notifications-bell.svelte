<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import BellIcon from '@lucide/svelte/icons/bell';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { timeAgo } from '$lib/utils';

	interface NotificationItem {
		id: string;
		title: string;
		body: string;
		read: boolean;
		created: string;
	}

	const POLL_MS = 30_000;
	const INVALIDATE_KEY = 'app:notifications';

	const notifications = $derived(
		(page.data.notifications ?? { count: 0, items: [] }) as {
			count: number;
			items: NotificationItem[];
		}
	);
	const badgeText = $derived(notifications.count > 99 ? '99+' : String(notifications.count));

	let lastSeenId: string | null = null;
	let primed = false;

	$effect(() => {
		const newest = notifications.items[0]?.id ?? null;
		if (!primed) {
			primed = true;
			lastSeenId = newest;
			return;
		}
		if (!newest || newest === lastSeenId) return;
		for (const item of notifications.items) {
			if (lastSeenId && item.id <= lastSeenId) break;
			toast.info(item.title, {
				description: item.body || undefined,
				action: { label: 'View', onClick: () => goto('/notifications') }
			});
		}
		lastSeenId = newest;
	});

	onMount(() => {
		const id = setInterval(() => {
			if (document.visibilityState === 'hidden') return;
			invalidate(INVALIDATE_KEY);
		}, POLL_MS);
		const onVisible = () => {
			if (document.visibilityState === 'visible') invalidate(INVALIDATE_KEY);
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			clearInterval(id);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});
</script>

<DropdownMenu.Root onOpenChange={(open) => open && invalidate(INVALIDATE_KEY)}>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button variant="ghost" size="icon" class="relative" aria-label="Notifications" {...props}>
				<BellIcon class="size-5" />
				{#if notifications.count > 0}
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
	<DropdownMenu.Content align="end" class="w-80 shadow-2xl shadow-black/40">
		<DropdownMenu.Label>Notifications</DropdownMenu.Label>
		<DropdownMenu.Separator />
		{#if notifications.items.length === 0}
			<div class="px-2 py-6 text-center text-sm text-muted-foreground">
				You're all caught up.
			</div>
		{:else}
			{#each notifications.items as item (item.id)}
				<DropdownMenu.Item class="p-0">
					<a
						href="/notifications"
						class="flex w-full flex-col gap-0.5 px-2 py-2 cursor-default"
					>
						<div class="flex items-center justify-between gap-2">
							<span class="text-sm font-medium truncate">{item.title}</span>
							<span
								class="shrink-0 text-[10px] text-muted-foreground tabular-nums"
								title={new Date(item.created).toLocaleString()}
							>
								{timeAgo(item.created)}
							</span>
						</div>
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
