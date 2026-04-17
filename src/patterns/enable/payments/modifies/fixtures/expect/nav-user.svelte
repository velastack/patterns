<script lang="ts">
import { toggleMode, mode } from 'mode-watcher';
import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
import Settings2Icon from '@lucide/svelte/icons/settings-2';
import LogOutIcon from '@lucide/svelte/icons/log-out';
import MoonIcon from '@lucide/svelte/icons/moon';
import SunIcon from '@lucide/svelte/icons/sun';
import * as Avatar from '$lib/components/ui/avatar';
import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
import * as Sidebar from '$lib/components/ui/sidebar';
import CreditCardIcon from '@lucide/svelte/icons/credit-card';

let data = {
    navUser: [
        {
            title: 'Settings',
            url: '/settings',
            icon: Settings2Icon
        },
        {
            title: 'Billing',
            url: '/billing',
            icon: CreditCardIcon
        }
    ]
};

let {
    user
}: {
    user: {
        id: string;
        name: string;
        email: string;
        avatar: string;
    };
} = $props();

const sidebar = Sidebar.useSidebar();
</script>

<Sidebar.Menu>
	<Sidebar.MenuItem>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Sidebar.MenuButton
						size="lg"
						class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						{...props}
					>
						<Avatar.Root class="size-8 rounded-lg">
							{#if user.avatar}
								<Avatar.Image src="/api/files/users/{user.id}/{user.avatar}" alt={user.name} />
							{/if}
							<Avatar.Fallback class="rounded-lg">
								{user.email?.charAt(0).toUpperCase()}
							</Avatar.Fallback>
						</Avatar.Root>
						<div class="grid flex-1 text-left text-sm leading-tight">
							<span class="truncate font-medium">{user.name}</span>
							<span class="truncate text-xs">{user.email}</span>
						</div>
						<ChevronsUpDownIcon class="ml-auto size-4" />
					</Sidebar.MenuButton>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content
				class="w-(--bits-dropdown-menu-anchor-width) min-w-56 rounded-lg"
				side={sidebar.isMobile ? 'bottom' : 'right'}
				align="end"
				sideOffset={4}
			>
				<DropdownMenu.Label class="p-0 font-normal">
					<div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
						<Avatar.Root class="size-8 rounded-lg">
							{#if user.avatar}
								<Avatar.Image src="/api/files/users/{user.id}/{user.avatar}" alt={user.name} />
							{/if}
							<Avatar.Fallback class="rounded-lg">
								{user.email?.charAt(0).toUpperCase()}
							</Avatar.Fallback>
						</Avatar.Root>
						<div class="grid flex-1 text-left text-sm leading-tight">
							<span class="truncate font-medium">{user.name}</span>
							<span class="truncate text-xs">{user.email}</span>
						</div>
					</div>
				</DropdownMenu.Label>
				<DropdownMenu.Separator />
				<DropdownMenu.Group>
					<DropdownMenu.Item onclick={toggleMode}>
						{#if mode.current === 'dark'}
							<SunIcon />
							Light mode
						{:else}
							<MoonIcon />
							Dark mode
						{/if}
					</DropdownMenu.Item>
					{#each data.navUser as item}
						<DropdownMenu.Item class="p-0">
							<a href={item.url} class="flex cursor-default items-center gap-2 px-2 py-1.5 w-full">
								<item.icon />
								{item.title}
							</a>
						</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Group>
				<DropdownMenu.Separator />
				<DropdownMenu.Item class="p-0">
					<form action="/logout" method="post" class="w-full">
						<button type="submit" class="flex cursor-default items-center gap-2 px-2 py-1.5 w-full">
							<LogOutIcon />
							Log out
						</button>
					</form>
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</Sidebar.MenuItem>
</Sidebar.Menu>
