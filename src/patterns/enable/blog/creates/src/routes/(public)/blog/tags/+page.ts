import { definePageMetaTags } from "svelte-meta-tags";
import { getAllTags } from "$lib/content";

export const load = async ({ parent }) => {
  await parent();

  const allTags = getAllTags();

  const pageMetaTags = definePageMetaTags({
    title: "Tags",
    description: "All tags used on the blog.",
  });

  const breadcrumbs = [
    { title: "Home", url: "/" },
    { title: "Blog", url: "/blog" },
    { title: "Tags", url: "/blog/tags" },
  ];

  return { allTags, breadcrumbs, ...pageMetaTags };
};
