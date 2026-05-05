import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["src/runtime/**/*.test.ts"],
    setupFiles: ["./src/core/test-utils.ts"],
  },
});
