<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";
  import { Separator } from "$lib/components/ui/separator";
  import AuthorChip from "$lib/components/blog/AuthorChip.svelte";
  import PostCard from "$lib/components/blog/PostCard.svelte";
  import { formatDate } from "$lib/utils/date";
  import * as Breadcrumb from "$lib/components/ui/breadcrumb";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import { page } from "$app/state";

  let { data } = $props();
  let breadcrumbs = $derived(page.data.breadcrumbs || []) as {
    title: string;
    url: string;
  }[];
</script>

<div class="flex flex-col gap-6">
  <header class="flex flex-col gap-5 border-b border-border pb-8">
    <div class="flex flex-col gap-3">
      <h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">
        {data.blogPost.title}
      </h1>
      <p class="text-muted-foreground text-lg">
        {data.blogPost.description}
      </p>
    </div>

    <div
      class="text-muted-foreground flex flex-wrap items-center gap-x-1 gap-y-2 text-sm"
    >
      {#if data.blogPost.author}
        <AuthorChip author={data.blogPost.author} />
        <span aria-hidden="true" class="text-muted-foreground/50">&bull;</span>
      {/if}
      <time datetime={data.blogPost.createdDate.toISOString()}>
        {formatDate(data.blogPost.createdDate)}
      </time>
      {#if data.blogPost.updatedDate}
        <span aria-hidden="true" class="text-muted-foreground/50">&bull;</span>
        <span>Updated {formatDate(data.blogPost.updatedDate)}</span>
      {/if}
      <span aria-hidden="true" class="text-muted-foreground/50">&bull;</span>
      <span>{data.blogPost.readingTime} min read</span>
    </div>

    {#if data.blogPost.tags?.length}
      <div class="flex flex-wrap gap-1.5">
        {#each data.blogPost.tags as tag (tag)}
          <Badge href={`/blog/tags/${tag}`} variant="secondary">{tag}</Badge>
        {/each}
      </div>
    {/if}
  </header>

  <article
    class="prose dark:prose-invert max-w-prose prose-headings:mb-0 prose-headings:mt-4"
  >
    <data.blogPost.component />
  </article>

  <Separator />

  <nav class="grid gap-3 sm:grid-cols-2" aria-label="Post navigation">
    {#if data.adjacent.prev}
      <a
        href={`/blog/${data.adjacent.prev.slug}`}
        class="ring-foreground/10 hover:ring-foreground/20 bg-card text-card-foreground group flex flex-col gap-1 rounded-xl p-4 ring-1 transition-shadow"
      >
        <span
          class="text-muted-foreground inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide"
        >
          <ArrowLeft class="size-3.5" />
          Previous
        </span>
        <span class="font-medium group-hover:underline"
          >{data.adjacent.prev.title}</span
        >
      </a>
    {:else}
      <div></div>
    {/if}

    {#if data.adjacent.next}
      <a
        href={`/blog/${data.adjacent.next.slug}`}
        class="ring-foreground/10 hover:ring-foreground/20 bg-card text-card-foreground group flex flex-col gap-1 rounded-xl p-4 text-right ring-1 transition-shadow sm:col-start-2"
      >
        <span
          class="text-muted-foreground inline-flex items-center justify-end gap-1 text-xs font-medium uppercase tracking-wide"
        >
          Next
          <ArrowRight class="size-3.5" />
        </span>
        <span class="font-medium group-hover:underline"
          >{data.adjacent.next.title}</span
        >
      </a>
    {/if}
  </nav>

  {#if data.related.length}
    <section class="flex flex-col gap-4">
      <Separator />
      <h2 class="text-xl font-semibold tracking-tight">Related posts</h2>
      <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each data.related as post (post.slug)}
          <li class="flex">
            <PostCard {post} />
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</div>
