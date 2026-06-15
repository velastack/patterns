import {
  ensureBooleanTrue,
  getOrCreateObjectLiteralProperty,
  modifyConfig,
  type ConfigModifyResult,
} from "./config-target";

const FAILURE_HINT = [
  "Enable SvelteKit remote functions and Svelte async in your config",
  "(the sveltekit() plugin arg in vite.config, or svelte.config):",
  "",
  "experimental: { remoteFunctions: true },",
  "compilerOptions: { experimental: { async: true } },",
].join("\n");

const NOT_FOUND_HINT = [
  "Enable SvelteKit remote functions and Svelte async by passing config to the",
  "sveltekit() plugin in vite.config.ts:",
  "",
  "import { sveltekit } from '@sveltejs/kit/vite';",
  "import { defineConfig } from 'vite';",
  "",
  "export default defineConfig({",
  "  plugins: [",
  "    sveltekit({",
  "      experimental: { remoteFunctions: true },",
  "      compilerOptions: { experimental: { async: true } },",
  "    }),",
  "  ],",
  "});",
].join("\n");

/**
 * Enable SvelteKit remote functions (`experimental.remoteFunctions`) and Svelte
 * async (`compilerOptions.experimental.async`) in whichever config the project
 * uses — the inline `sveltekit()` arg in vite.config, or svelte.config.
 *
 * `remoteFunctions` is kit-namespaced (→ `kitContainer()`); `async` is a
 * root-level compiler option (→ `configObject`).
 */
export function modifySvelteConfigRemote(root: string): ConfigModifyResult {
  return modifyConfig(
    root,
    { notFound: NOT_FOUND_HINT, failed: FAILURE_HINT },
    (target) => {
      const kit = target.kitContainer();
      if (!kit) return false;
      const kitExperimental = getOrCreateObjectLiteralProperty(
        kit,
        "experimental",
        "{}",
      );
      if (!kitExperimental) return false;
      ensureBooleanTrue(kitExperimental, "remoteFunctions");

      const compilerObj = getOrCreateObjectLiteralProperty(
        target.configObject,
        "compilerOptions",
        "{}",
      );
      if (!compilerObj) return false;
      const compilerExperimental = getOrCreateObjectLiteralProperty(
        compilerObj,
        "experimental",
        "{}",
      );
      if (!compilerExperimental) return false;
      ensureBooleanTrue(compilerExperimental, "async");

      return true;
    },
  );
}
