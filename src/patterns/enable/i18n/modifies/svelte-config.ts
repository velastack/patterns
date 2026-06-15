import { SyntaxKind, type PropertyAssignment } from "ts-morph";
import {
  getOrCreateObjectLiteralProperty,
  modifyConfig,
  type ConfigModifyResult,
} from "../../../../runtime/config-target";

const FAILURE_HINT = [
  "Add the $locales alias to your config (sveltekit() arg in vite.config, or svelte.config):",
  "",
  "alias: {",
  "  $locales: 'src/locales',",
  "},",
].join("\n");

const NOT_FOUND_HINT = [
  "Add the $locales alias by passing config to the sveltekit() plugin in vite.config.ts:",
  "",
  "import { sveltekit } from '@sveltejs/kit/vite';",
  "import { defineConfig } from 'vite';",
  "",
  "export default defineConfig({",
  "  plugins: [sveltekit({ alias: { $locales: 'src/locales' } })],",
  "});",
].join("\n");

/** Ensure the `$locales` alias points at `src/locales`. */
export function modifySvelteConfig(root: string): ConfigModifyResult {
  return modifyConfig(
    root,
    { notFound: NOT_FOUND_HINT, failed: FAILURE_HINT },
    (target) => {
      const kit = target.kitContainer();
      if (!kit) return false;
      const aliasObj = getOrCreateObjectLiteralProperty(kit, "alias", "{}");
      if (!aliasObj) return false;

      const existing = aliasObj.getProperty("$locales");
      if (!existing) {
        aliasObj.addPropertyAssignment({
          name: "$locales",
          initializer: "'src/locales'",
        });
        return true;
      }
      if (existing.getKind() !== SyntaxKind.PropertyAssignment) return false;

      const init = (existing as PropertyAssignment).getInitializer();
      const current = init?.getText()?.replace(/['"`]/g, "");
      if (current !== "src/locales") {
        (existing as PropertyAssignment).setInitializer("'src/locales'");
      }
      return true;
    },
  );
}
