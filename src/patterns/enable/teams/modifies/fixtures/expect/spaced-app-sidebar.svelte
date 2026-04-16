<script lang="ts">
  import type { ComponentProps } from "svelte";
  import HomeIcon from "@lucide/svelte/icons/home";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import NavMain from "./nav-main.svelte";
  import NavUser from "./nav-user.svelte";
import TeamSwitcher from '$lib/components/team-switcher.svelte';
import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
import * as Avatar from '$lib/components/ui/avatar';


  let data = {
    navMain: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: HomeIcon,
      },
    ],
  };


  let {
    user,
    meta,
    team,
    teams = [],
    ref = $bindable(null),
    ...restProps
  }: ComponentProps<typeof Sidebar.Root> & {
    user: any;
    meta: any;
    team?: string | undefined;
    teams?: { id: string; name: string }[];
  } = $props();
</script>


<Sidebar.Root bind:ref variant="inset" {...restProps}>


  <Sidebar.Header>
		<Sidebar.Menu>
			<TeamSwitcher {teams}>
				{#snippet children()}
					{@const activeTeam = teams.find((t) => t.id === team)}
					{#if activeTeam}
						<Avatar.Root class="size-8 rounded-lg">
							<Avatar.Fallback class="rounded-lg bg-primary text-primary-foreground font-medium">
								{activeTeam.name?.charAt(0).toUpperCase()}
							</Avatar.Fallback>
						</Avatar.Root>
						<div class="grid flex-1 text-left text-sm leading-tight">
							<span class="truncate font-medium">
								{activeTeam.name}
							</span>
						</div>
					{:else}
						<div
							class="bg-sidebar-accent text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg"
						>
							<img src="/favicon.svg" alt="logo" class="size-6" />
						</div>
						<div class="grid flex-1 text-left text-sm leading-tight">
							<span class="truncate font-medium">{meta.appName}</span>
						</div>
					{/if}
					<ChevronsUpDownIcon class="ml-auto" />
				{/snippet}
			</TeamSwitcher>
		</Sidebar.Menu>
	</Sidebar.Header>


  <Sidebar.Content>
    <NavMain items={data.navMain} />
  </Sidebar.Content>
  <Sidebar.Footer>
    <NavUser {user} />
  </Sidebar.Footer>
</Sidebar.Root>
