import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
// [!code highlight:1]
import { wuchale } from "wuchale/vite";

export default defineConfig({
  // [!code highlight:1]
  plugins: [wuchale(), tailwindcss(), sveltekit()],
});
