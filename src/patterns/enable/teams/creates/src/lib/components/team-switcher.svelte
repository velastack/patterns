<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import UsersIcon from '@lucide/svelte/icons/users';
	import { page } from '$app/state';
	import { goto, invalidate } from '$app/navigation';

	let { teams, children }: { teams: { id: string; name: string }[] } & { children: Snippet } =
		$props();

	const switchTeam = async (teamId: string) => {
		await goto(`/teams/switch/${teamId}?redirect=${encodeURIComponent(page.url.pathname)}`);
		invalidate('app:team');
	};

	const sidebar = useSidebar();
</script>

<Sidebar.Menu>
	<Sidebar.MenuItem>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Sidebar.MenuButton
						{...props}
						size="lg"
						class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
					>
						{@render children?.()}
					</Sidebar.MenuButton>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content
				class="w-(--bits-dropdown-menu-anchor-width) min-w-56 rounded-lg"
				align="start"
				side={sidebar.isMobile ? 'bottom' : 'right'}
				sideOffset={4}
			>
				<DropdownMenu.Label class="text-muted-foreground text-xs">Teams</DropdownMenu.Label>
				{#each teams as team (team.name)}
					<DropdownMenu.Item onSelect={() => switchTeam(team.id)} class="gap-2 p-2">
						<div class="flex size-6 items-center justify-center rounded-md border">
							<UsersIcon class="size-3.5 shrink-0" />
						</div>
						{team.name}
					</DropdownMenu.Item>
				{/each}
				<DropdownMenu.Separator />
				<DropdownMenu.Item class="gap-2 p-2">
					<div class="flex size-6 items-center justify-center rounded-md border bg-transparent">
						<PlusIcon class="size-4" />
					</div>
					<a href="/teams/new" class="text-muted-foreground font-medium">Add team</a>
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</Sidebar.MenuItem>
</Sidebar.Menu>
