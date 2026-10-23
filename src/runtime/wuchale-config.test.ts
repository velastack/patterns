import { describe, expect, it } from "vitest";
import { withWuchaleJsFiles } from "./wuchale-config";

const CONFIG = `// @ts-check
import { adapter as svelte } from "@wuchale/svelte";
import { adapter as js } from "wuchale/adapter-vanilla";
import { defineConfig } from "wuchale";

export default defineConfig({
  locales: ["en", "es"],
  adapters: {
    main: svelte({ loader: "sveltekit" }),
    js: js({
      loader: "vite",
      files: [
        "src/**/+{page,layout}.{js,ts}",
        "src/**/+{page,layout}.server.{js,ts}",
      ],
    }),
  },
});
`;

describe("withWuchaleJsFiles", () => {
  it("adds a file to the js adapter's list once", () => {
    const added = withWuchaleJsFiles(CONFIG, ["src/lib/order.ts"]);
    expect(added?.changed).toBe(true);
    expect(added?.source).toContain(`"src/**/+{page,layout}.server.{js,ts}",`);
    expect(added?.source).toContain(`"src/lib/order.ts"`);
    // The svelte adapter is left alone.
    expect(added?.source).toContain(`main: svelte({ loader: "sveltekit" })`);

    const again = withWuchaleJsFiles(added!.source, ["src/lib/order.ts"]);
    expect(again?.changed).toBe(false);
    expect(again?.source).toBe(added!.source);
  });

  it("matches the quotes the list already uses", () => {
    const single = CONFIG.replace(
      /"src\/\*\*[^"]*"/g,
      (m) => `'${m.slice(1, -1)}'`,
    );
    const added = withWuchaleJsFiles(single, ["src/lib/order.ts"]);
    expect(added?.source).toContain(`'src/lib/order.ts'`);
  });

  it("removes a file and leaves the rest", () => {
    const added = withWuchaleJsFiles(CONFIG, ["src/lib/order.ts"])!.source;
    const removed = withWuchaleJsFiles(added, ["src/lib/order.ts"], "remove");
    expect(removed?.changed).toBe(true);
    expect(removed?.source).not.toContain("src/lib/order.ts");
    expect(removed?.source).toContain(`"src/**/+{page,layout}.{js,ts}",`);

    const absent = withWuchaleJsFiles(CONFIG, ["src/lib/order.ts"], "remove");
    expect(absent?.changed).toBe(false);
  });

  it("gives up on a config without a js adapter list", () => {
    const noJs = `export default { adapters: { main: svelte({}) } };\n`;
    expect(withWuchaleJsFiles(noJs, ["src/lib/order.ts"])).toBeNull();
  });
});
