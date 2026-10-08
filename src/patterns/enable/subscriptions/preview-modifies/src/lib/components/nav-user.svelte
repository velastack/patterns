<script lang="ts">
  import { toggleMode, mode } from "mode-watcher";
  import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
  import Settings2Icon from "@lucide/svelte/icons/settings-2";
  import CreditCardIcon from "@lucide/svelte/icons/credit-card";
  import LogOutIcon from "@lucide/svelte/icons/log-out";
  import MoonIcon from "@lucide/svelte/icons/moon";
  import SunIcon from "@lucide/svelte/icons/sun";
  import UserAvatar from "#lib/components/user-avatar.svelte";
  import { displayName, type UserIdentity } from "#lib/user.js";
  import * as DropdownMenu from "#lib/components/ui/dropdown-menu/index.js";
  import * as Sidebar from "#lib/components/ui/sidebar/index.js";

  let data = {
    navUser: [
      {
        title: "Settings",
        url: "/settings",
        icon: Settings2Icon,
      },
      {
        title: "Billing",
        url: "/billing",
        icon: CreditCardIcon,
      },
    ],
  };

  let {
    user,
    // [!code highlight:1]
    subscription = null,
  }: {
    user: UserIdentity & {
      id: string;
      avatar: string;
    };
    // [!code highlight:1]
    subscription?: { id: string; productName: string | null } | null;
  } = $props();

  // [!code highlight:1]
  const planLabel = $derived(subscription?.productName ?? "Free");

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
            <UserAvatar {user} class="size-8 rounded-lg" fallbackClass="rounded-lg" />
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-medium">
                {displayName(user)}
              </span>
              <!-- [!code highlight:3] -->
              <span class="truncate text-xs text-muted-foreground">
                {planLabel}
              </span>
            </div>
            <ChevronsUpDownIcon class="ml-auto size-4" />
          </Sidebar.MenuButton>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        class="w-(--bits-dropdown-menu-anchor-width) min-w-56 rounded-lg"
        side={sidebar.isMobile ? "bottom" : "right"}
        align="end"
        sideOffset={4}
      >
        <DropdownMenu.Label class="p-0 font-normal">
          <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <UserAvatar {user} class="size-8 rounded-lg" fallbackClass="rounded-lg" />
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-medium">
                {displayName(user)}
              </span>
              <!-- [!code highlight:3] -->
              <span class="truncate text-xs">
                {planLabel}
              </span>
            </div>
          </div>
        </DropdownMenu.Label>
        <DropdownMenu.Separator />
        <DropdownMenu.Group>
          <DropdownMenu.Item onclick={toggleMode}>
            {#if mode.current === "dark"}
              <SunIcon />
              Light mode
            {:else}
              <MoonIcon />
              Dark mode
            {/if}
          </DropdownMenu.Item>
          {#each data.navUser as item}
            <DropdownMenu.Item class="p-0">
              <a
                href={item.url}
                class="flex cursor-default items-center gap-2 px-2 py-1.5 w-full"
              >
                <item.icon />
                {item.title}
              </a>
            </DropdownMenu.Item>
          {/each}
        </DropdownMenu.Group>
        <DropdownMenu.Separator />
        <DropdownMenu.Item class="p-0">
          <form action="/logout" method="post" class="w-full">
            <button
              type="submit"
              class="flex cursor-default items-center gap-2 px-2 py-1.5 w-full"
            >
              <LogOutIcon />
              Log out
            </button>
          </form>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </Sidebar.MenuItem>
</Sidebar.Menu>
