import fs from "node:fs";

/** Matches Velastack auth output (single quotes) and Prettier-formatted files (double quotes). */
const NAV_USER_IMPORT_RE =
  /import NavUser from ['"]\.\/nav-user\.svelte['"];/;

const IMPORTS_AFTER_NAV_USER = `import NavUser from './nav-user.svelte';
import TeamSwitcher from '$lib/components/team-switcher.svelte';
import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
import * as Avatar from '$lib/components/ui/avatar';`;

const NEW_HEADER = `<Sidebar.Header>
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
	</Sidebar.Header>`;

export function modifyAppSidebar(appSidebarPath: string): boolean {
  if (!fs.existsSync(appSidebarPath)) {
    return false;
  }

  let s = fs.readFileSync(appSidebarPath, "utf8");
  if (s.includes("TeamSwitcher")) {
    return false;
  }

  if (!NAV_USER_IMPORT_RE.test(s)) {
    return false;
  }

  s = s.replace(NAV_USER_IMPORT_RE, IMPORTS_AFTER_NAV_USER);

  s = s.replace(
    /let \{[\s\S]*?\}: ComponentProps<typeof Sidebar\.Root> & \{ user: any; meta: any \} = \$props\(\);/,
    `let {
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
	} = $props();`,
  );

  const headerMatch = s.match(/<Sidebar\.Header>[\s\S]*?<\/Sidebar\.Header>/);
  if (!headerMatch) {
    return false;
  }

  s = s.replace(headerMatch[0], NEW_HEADER);

  fs.writeFileSync(appSidebarPath, s, "utf8");
  return true;
}
