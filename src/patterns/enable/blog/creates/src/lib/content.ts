import type { Component } from "svelte";

export type BlogAuthor = {
  name: string;
  avatar?: string;
};

export type BlogMetadata = {
  title: string;
  description: string;
  createdDate: string;
  updatedDate?: string;
  tags?: string[];
  author?: BlogAuthor;
};

export type BlogModules = Record<
  string,
  { default: Component; metadata: BlogMetadata }
>;

export type BlogRawModules = Record<string, string>;

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  createdDate: Date;
  updatedDate?: Date;
  tags?: string[];
  author?: BlogAuthor;
  readingTime: number;
  component: Component;
};

export type BlogPostSummary = Omit<BlogPost, "component">;

const WORDS_PER_MINUTE = 220;

function getBlogModules() {
  return import.meta.glob("$lib/content/blog/*.svx", {
    eager: true,
  }) as BlogModules;
}

function getBlogRawModules() {
  return import.meta.glob("$lib/content/blog/*.svx", {
    eager: true,
    query: "?raw",
    import: "default",
  }) as BlogRawModules;
}

function stripFrontmatter(raw: string) {
  if (!raw.startsWith("---")) return raw;
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return raw;
  return raw.slice(end + 4);
}

function computeReadingTime(raw: string) {
  const body = stripFrontmatter(raw);
  const words = body.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

export function getBlogPosts(): BlogPost[] {
  const modules = getBlogModules();
  const rawModules = getBlogRawModules();

  const posts = Object.entries(modules).map(([path, module]) => {
    const filename = path.split("/").pop() ?? "";
    const slug = filename.replace(".svx", "");
    const raw = rawModules[path] ?? "";

    return {
      slug,
      title: module.metadata.title,
      description: module.metadata.description,
      createdDate: new Date(module.metadata.createdDate),
      updatedDate: module.metadata.updatedDate
        ? new Date(module.metadata.updatedDate)
        : undefined,
      tags: module.metadata.tags,
      author: module.metadata.author,
      readingTime: computeReadingTime(raw),
      component: module.default,
    };
  });

  posts.sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime());
  return posts;
}

export function getBlogPost(slug: string) {
  const posts = getBlogPosts();
  return posts.find((post) => post.slug === slug) ?? null;
}

export function getBlogPostRaw(slug: string): string | null {
  const rawModules = getBlogRawModules();
  for (const [path, raw] of Object.entries(rawModules)) {
    const filename = path.split("/").pop() ?? "";
    if (filename.replace(".svx", "") === slug) return raw;
  }
  return null;
}

export function getBlogPostsByTag(tag: string) {
  return getBlogPosts().filter((post) => post.tags?.includes(tag));
}

export function getAllTags(): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const post of getBlogPosts()) {
    for (const tag of post.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function getAdjacentPosts(slug: string): {
  prev: BlogPost | null;
  next: BlogPost | null;
} {
  const posts = getBlogPosts();
  const index = posts.findIndex((post) => post.slug === slug);
  if (index === -1) return { prev: null, next: null };
  return {
    next: index > 0 ? posts[index - 1] : null,
    prev: index < posts.length - 1 ? posts[index + 1] : null,
  };
}

export function getRelatedPosts(slug: string, limit = 3): BlogPost[] {
  const posts = getBlogPosts();
  const current = posts.find((post) => post.slug === slug);
  if (!current?.tags?.length) return [];

  const currentTags = new Set(current.tags);

  return posts
    .filter((post) => post.slug !== slug && post.tags?.length)
    .map((post) => ({
      post,
      overlap: post.tags!.filter((tag) => currentTags.has(tag)).length,
    }))
    .filter(({ overlap }) => overlap > 0)
    .sort(
      (a, b) =>
        b.overlap - a.overlap ||
        b.post.createdDate.getTime() - a.post.createdDate.getTime(),
    )
    .slice(0, limit)
    .map(({ post }) => post);
}
