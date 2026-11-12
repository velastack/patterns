// @ts-check
import { adapter as svelte, createSvelteHeuristic } from "@wuchale/svelte";
import { adapter as js } from "wuchale/adapter-vanilla";
import { defaultHeuristicOpts, defineConfig } from "wuchale";

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
      // The pages with a URL per language (`/`, `/es`): the public ones. A
      // page that is not listed, such as a sign-in page or one behind it, has
      // one URL and follows the visitor's preference (src/lib/locale.ts).
      url: { localize: "src/lib/url.ts", patterns: ["/"] },
      // wuchale localizes the `href` of an <a> by default, when the path is
      // one of the `url.patterns` above. Most links are components that render
      // an <a>, and a tag is matched by the name it is written with, so each
      // is listed; without this the navbar on /es points at the English pages.
      // A link component of your own goes here too.
      heuristic: createSvelteHeuristic({
        ...defaultHeuristicOpts,
        urlCalls: ["asset", "goto", "pushState", "replaceState", "resolve"],
        urlAttribs: [
          ["a", "href"],
          ["Button", "href"],
          ["Badge", "href"],
          ["Navbar.Brand", "href"],
          ["Navbar.Link", "href"],
          ["AuthMenu.Item", "href"],
          ["Breadcrumb.Link", "href"],
          ["NavigationMenu.Link", "href"],
          ["Sidebar.MenuSubButton", "href"],
          ["Command.LinkItem", "href"],
          ["HoverCard.Trigger", "href"],
        ],
      }),
    }),
    js: js({
      loader: "vite",
      files: [
        "src/**/+{page,layout}.{js,ts}",
        "src/**/+{page,layout}.server.{js,ts}",
        // Remote functions answer with messages a visitor reads too.
        "src/**/*.remote.{js,ts}",
      ],
    }),
  },
});
