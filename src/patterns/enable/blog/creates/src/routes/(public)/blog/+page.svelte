<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import PostCard from "$lib/components/blog/PostCard.svelte";
  import Rss from "@lucide/svelte/icons/rss";

  let { data } = $props();
</script>

<div class="flex flex-col gap-10">
  <header
    class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
  >
    <div class="max-w-2xl">
      <h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">Blog</h1>
      <p class="text-muted-foreground mt-2 text-base">
        Product notes, tutorials, and engineering posts from the team.
      </p>
    </div>
    <Button href="/blog/rss.xml" variant="outline" size="sm" class="w-fit">
      <Rss class="size-4" />
      RSS
    </Button>
  </header>

  <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each data.blogPosts as post (post.slug)}
      <li class="flex w-full">
        <PostCard {post} />
      </li>
    {/each}
  </ul>
</div>
