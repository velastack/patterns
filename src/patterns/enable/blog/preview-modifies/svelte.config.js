import adapter from "@sveltejs/adapter-node";
// [!code highlight:1]
import { mdsvex } from "mdsvex";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // [!code highlight:2]
  extensions: [".svelte", ".svx"],
  preprocess: [mdsvex()],
  compilerOptions: {
    // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
    runes: ({ filename }) =>
      filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
  },
  kit: {
    adapter: adapter(),
  },
};

export default config;
