<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import AuthorChip from "./AuthorChip.svelte";
  import { formatDate } from "$lib/utils/date";
  import type { BlogPost, BlogPostSummary } from "$lib/content";

  let { post }: { post: BlogPost | BlogPostSummary } = $props();
</script>

<Card.Root class="hover:ring-foreground/20 h-full transition-shadow w-full">
  <Card.Header>
    <Card.Title class="text-lg leading-snug">
      <a href={`/blog/${post.slug}`} class="hover:underline">
        {post.title}
      </a>
    </Card.Title>
    <Card.Description class="line-clamp-2">
      {post.description}
    </Card.Description>
  </Card.Header>
  <Card.Content class="flex flex-1 flex-col justify-end gap-3">
    {#if post.tags?.length}
      <div class="flex flex-wrap gap-1.5">
        {#each post.tags as tag (tag)}
          <Badge href={`/blog/tags/${tag}`} variant="secondary">{tag}</Badge>
        {/each}
      </div>
    {/if}
    <div
      class="text-muted-foreground flex items-center justify-between gap-3 text-xs"
    >
      {#if post.author}
        <AuthorChip author={post.author} />
      {:else}
        <span></span>
      {/if}
      <span class="whitespace-nowrap">
        <time datetime={post.createdDate.toISOString()}
          >{formatDate(post.createdDate)}</time
        >
        <span aria-hidden="true">&bull;</span>
        <span>{post.readingTime} min read</span>
      </span>
    </div>
  </Card.Content>
</Card.Root>
