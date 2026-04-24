<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { Separator } from "$lib/components/ui/separator";
  import AppSidebar from "$lib/components/app-sidebar.svelte";
  import * as Breadcrumb from "$lib/components/ui/breadcrumb";
  import { page } from "$app/state";

  let breadcrumbs = $derived(page.data.breadcrumbs || []) as {
    title: string;
    url: string;
  }[];
  let { data, children } = $props();
</script>

<div class="min-h-dvh dashboard">
  <Sidebar.Provider>
    <!-- [!code highlight:5] -->
    <AppSidebar
      user={data.user}
      meta={data.meta}
      subscription={data.subscription}
    />
    <Sidebar.Inset>
      <header class="flex h-16 shrink-0 items-center gap-2">
        <div class="flex items-center gap-2 px-4">
          <Sidebar.Trigger class="-ml-1" />
          <Separator
            orientation="vertical"
            class="mr-2 data-[orientation=vertical]:h-4"
          />
          {#if breadcrumbs.length > 0}
            <Breadcrumb.Root>
              <Breadcrumb.List>
                {#if breadcrumbs.length > 1}
                  {#each breadcrumbs.slice(0, -1) as breadcrumb}
                    <Breadcrumb.Item>
                      <Breadcrumb.Link href={breadcrumb.url}
                        >{breadcrumb.title}</Breadcrumb.Link
                      >
                    </Breadcrumb.Item>
                    <Breadcrumb.Separator />
                  {/each}
                {/if}
                <Breadcrumb.Page>
                  {breadcrumbs[breadcrumbs.length - 1].title}
                </Breadcrumb.Page>
              </Breadcrumb.List>
            </Breadcrumb.Root>
          {/if}
        </div>
      </header>
      <div class="flex flex-1 flex-col p-4 pt-0">
        {@render children?.()}
      </div>
    </Sidebar.Inset>
  </Sidebar.Provider>
</div>

<style>
  :global(body:has(div.dashboard)) {
    background-color: var(--color-sidebar);
  }
</style>
