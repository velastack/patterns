import { defineConfig } from "vitest/config";

/**
 * Integration suite: scaffolds real projects with `vela create`, applies
 * patterns and type-checks the result. Run with `npm run test:integration`.
 *
 * Files run one at a time: they share the `node_modules` cache under
 * `.integration-tests/.cache`, spawn PocketBase on random ports, and each
 * `it` block changes `process.cwd()` (hence the forks pool).
 */
export default defineConfig({
  test: {
    include: ["integration/**/*.test.ts"],
    pool: "forks",
    fileParallelism: false,
    testTimeout: 20 * 60 * 1000,
    hookTimeout: 20 * 60 * 1000,
    reporters: ["verbose"],
  },
});
