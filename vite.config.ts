import { builtinModules } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import dts from "vite-plugin-dts";
import pkg from "./package.json" with { type: "json" };

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Node built-ins as imported in the wild: `fs` or `node:fs`. */
const nodeBuiltinIds = new Set<string>();
for (const name of builtinModules) {
  nodeBuiltinIds.add(name);
  nodeBuiltinIds.add(`node:${name}`);
}

const peerDependencyNames = Object.keys(pkg.peerDependencies ?? {});
const dependencyNames = Object.keys(pkg.dependencies ?? {});

function isExternalDependency(id: string): boolean {
  for (const dep of dependencyNames) {
    if (id === dep || id.startsWith(`${dep}/`)) return true;
  }
  for (const dep of peerDependencyNames) {
    if (id === dep || id.startsWith(`${dep}/`)) return true;
  }
  return false;
}

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Everything under a pattern's own `src/` is a template destined for a
    // generated project, not a test of this package. Listing source dirs
    // individually instead let `src/runtime` sit uncollected for months.
    exclude: ["src/patterns/**/src/**"],
    setupFiles: ["./src/core/test-utils.ts"],
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      fileName: "index",
      formats: ["es"],
    },
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rolldownOptions: {
      external: (id) => nodeBuiltinIds.has(id) || isExternalDependency(id),
      output: {
        entryFileNames: "index.js",
        chunkFileNames: "chunks/[name]-[hash].js",
      },
    },
  },
  plugins: [
    dts({
      rollupTypes: true,
      insertTypesEntry: true,
      exclude: [
        "**/node_modules/**",
        "**/fixtures/**",
        "**/preview-modifies/**",
        "**/creates/**",
        "**/creates-app-mode/**",
        "**/creates-backend/**",
        "**/variants/**",
      ],
    }),
  ],
});
