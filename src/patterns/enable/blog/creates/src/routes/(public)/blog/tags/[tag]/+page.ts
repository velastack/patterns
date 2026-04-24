import { error } from "@sveltejs/kit";
import { definePageMetaTags } from "svelte-meta-tags";
import { getAllTags, getBlogPostsByTag } from "$lib/content";

export const load = async ({ params, parent }) => {
  await parent();

  const blogPosts = getBlogPostsByTag(params.tag);

  if (blogPosts.length === 0) {
    throw error(404, "Tag not found");
  }

  const pageMetaTags = definePageMetaTags({
    title: `Posts tagged "${params.tag}"`,
    description: `Blog posts tagged "${params.tag}".`,
  });

  const breadcrumbs = [
    { title: "Home", url: "/" },
    { title: "Blog", url: "/blog" },
    { title: "Tags", url: "/blog/tags" },
    { title: params.tag, url: `/blog/tags/${params.tag}` },
  ];

  return { blogPosts, tag: params.tag, breadcrumbs, ...pageMetaTags };
};

export const entries = async () => {
  return getAllTags().map(({ tag }) => ({ tag }));
};
