import { negotiate } from "$lib/negotiate";
import { getBlogPostRaw } from "$lib/content";

export const load = async ({ params, locals }) => {
  return {
    ...negotiate(locals, {
      "text/markdown": () => getBlogPostRaw(params.slug) ?? "",
    }),
  };
};
