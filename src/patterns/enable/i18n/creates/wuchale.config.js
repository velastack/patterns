// @ts-check
import { adapter as svelte } from "@wuchale/svelte";
import { adapter as js } from "wuchale/adapter-vanilla";
import { defineConfig } from "wuchale";

export default defineConfig({
  locales: ["en", "es"],
  // `vela test:server` stubs every +page.svelte. In the default `refs` dev mode
  // the extractor would take those stubs at face value, drop the pages'
  // references from the .po files and recompile the catalogs while requests
  // are in flight. Under TEST wuchale neither transforms nor writes anything.
  ...(process.env.TEST === "true" ? { dev: false } : {}),
  adapters: {
    main: svelte({
      loader: "sveltekit",
      url: { localize: "src/lib/url.ts", patterns: ["/"] },
    }),
    js: js({
      loader: "vite",
      files: [
        "src/**/+{page,layout}.{js,ts}",
        "src/**/+{page,layout}.server.{js,ts}",
      ],
    }),
  },
});
