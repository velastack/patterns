<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";

  let { data } = $props();
</script>

<div class="flex flex-col gap-8">
  <header class="flex flex-col gap-2">
    <h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">Tags</h1>
    <p class="text-muted-foreground text-base">
      {data.allTags.length}
      {data.allTags.length === 1 ? "tag" : "tags"} used across the blog.
    </p>
  </header>

  {#if data.allTags.length}
    <ul class="flex flex-wrap gap-2">
      {#each data.allTags as { tag, count } (tag)}
        <li>
          <Badge href={`/blog/tags/${tag}`} variant="secondary">
            {tag}
            <span class="text-muted-foreground ml-0.5">{count}</span>
          </Badge>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="text-muted-foreground">No tags yet.</p>
  {/if}
</div>
