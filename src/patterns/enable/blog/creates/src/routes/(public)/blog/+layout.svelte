<script lang="ts">
  import * as Breadcrumb from "$lib/components/ui/breadcrumb";
  import { page } from "$app/state";

  let { children } = $props();

  let breadcrumbs = $derived(page.data.breadcrumbs || []) as {
    title: string;
    url: string;
  }[];
</script>

<section data-role="content">
  <Breadcrumb.Root class="mb-6">
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

  {@render children?.()}
</section>
