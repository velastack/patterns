import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import dts from "vite-plugin-dts";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ["src/core/**/*.test.ts", "src/patterns/**/*.test.ts"],
    exclude: ["src/patterns/**/src/**"],
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
    rollupOptions: {
      output: {
        entryFileNames: "index.js",
        inlineDynamicImports: true,
      },
    },
  },
  plugins: [
    dts({
      rollupTypes: true,
      insertTypesEntry: true,
      exclude: [
        "**/node_modules/**",
        "src/baselines/**",
        "**/preview-modifies/**",
        "**/creates/**",
      ],
    }),
  ],
});
