import { negotiate } from "#lib/negotiate.js";
import { getBlogPostRaw } from "#lib/content.js";

export const load = async ({ params, locals }) => {
  return {
    ...negotiate(locals, {
      "text/markdown": () => getBlogPostRaw(params.slug) ?? "",
    }),
  };
};
