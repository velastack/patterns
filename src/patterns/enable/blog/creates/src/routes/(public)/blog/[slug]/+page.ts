import { error } from "@sveltejs/kit";
import { definePageMetaTags } from "svelte-meta-tags";
import {
  getAdjacentPosts,
  getBlogPost,
  getBlogPosts,
  getRelatedPosts,
} from "$lib/content";

export const load = async ({ params, parent }) => {
  await parent();

  const blogPost = getBlogPost(params.slug);

  if (blogPost === null) {
    throw error(404, "Page not found");
  }

  const adjacent = getAdjacentPosts(params.slug);
  const related = getRelatedPosts(params.slug);

  const pageMetaTags = definePageMetaTags({
    title: blogPost.title,
    description: blogPost.description,
  });

  const breadcrumbs = [
    { title: "Home", url: "/" },
    { title: "Blog", url: "/blog" },
    { title: blogPost.title, url: `/blog/${blogPost.slug}` },
  ];

  return { blogPost, adjacent, related, breadcrumbs, ...pageMetaTags };
};

export const entries = async () => {
  return getBlogPosts().map((post) => ({ slug: post.slug }));
};
