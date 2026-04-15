import adapter from "@sveltejs/adapter-auto";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter,
    // [!code highlight:3]
    alias: {
      $locales: "src/locales",
    },
  },
};

export default config;
