import { definePageMetaTags } from "svelte-meta-tags";
import { getAllTags, getBlogPosts } from "$lib/content";

export const load = async ({ parent }) => {
  await parent();

  const blogPosts = getBlogPosts();
  const allTags = getAllTags();

  const pageMetaTags = definePageMetaTags({
    title: "Blog",
    description: "Product notes, tutorials, and engineering posts.",
  });

  const breadcrumbs = [
    { title: "Home", url: "/" },
    { title: "Blog", url: "/blog" },
  ];

  return { blogPosts, allTags, breadcrumbs, ...pageMetaTags };
};
