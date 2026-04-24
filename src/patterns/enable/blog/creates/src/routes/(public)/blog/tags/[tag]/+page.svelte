<script lang="ts">
  import PostCard from "$lib/components/blog/PostCard.svelte";

  let { data } = $props();
</script>

<div class="flex flex-col gap-8">
  <header class="flex flex-col gap-2">
    <h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">
      {data.tag}
    </h1>
    <p class="text-muted-foreground text-base">
      {data.blogPosts.length}
      {data.blogPosts.length === 1 ? "post" : "posts"} tagged "{data.tag}".
    </p>
  </header>

  <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each data.blogPosts as post (post.slug)}
      <li class="flex">
        <PostCard {post} />
      </li>
    {/each}
  </ul>
</div>
