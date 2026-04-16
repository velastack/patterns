<script lang="ts">
  import type { ComponentProps } from "svelte";
  import HomeIcon from "@lucide/svelte/icons/home";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import NavMain from "./nav-main.svelte";
  import NavUser from "./nav-user.svelte";

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
    ref = $bindable(null),
    ...restProps
  }: ComponentProps<typeof Sidebar.Root> & { user: any; meta: any } = $props();
</script>

<Sidebar.Root bind:ref variant="inset" {...restProps}>
  <Sidebar.Header>
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <Sidebar.MenuButton size="lg">
          {#snippet child({ props })}
            <a href="/dashboard" {...props}>
              <div
                class="bg-sidebar-accent text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg"
              >
                <img src="/favicon.svg" alt="logo" class="size-6" />
              </div>
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-medium">{meta.appName}</span>
              </div>
            </a>
          {/snippet}
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  </Sidebar.Header>
  <Sidebar.Content>
    <NavMain items={data.navMain} />
  </Sidebar.Content>
  <Sidebar.Footer>
    <NavUser {user} />
  </Sidebar.Footer>
</Sidebar.Root>
