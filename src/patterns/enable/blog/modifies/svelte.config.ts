import dedent from "dedent";
import {
  SyntaxKind,
  type ArrayLiteralExpression,
  type ObjectLiteralExpression,
} from "ts-morph";
import {
  modifyConfig,
  type ConfigModifyResult,
} from "../../../../runtime/config-target";
import { ensureImports } from "../../../../runtime/ts-morph-helpers";

const FAILURE_HINT = dedent`
  Enable mdsvex in your config (sveltekit() arg in vite.config, or svelte.config):

  import { mdsvex } from 'mdsvex';

  // ...
  extensions: ['.svelte', '.svx'],
  preprocess: [mdsvex()],
`;

const NOT_FOUND_HINT = dedent`
  Enable mdsvex by passing config to the sveltekit() plugin in vite.config.ts:

  import { sveltekit } from '@sveltejs/kit/vite';
  import { mdsvex } from 'mdsvex';
  import { defineConfig } from 'vite';

  export default defineConfig({
    plugins: [
      sveltekit({
        extensions: ['.svelte', '.svx'],
        preprocess: [mdsvex()],
      }),
    ],
  });
`;

function ensureExtensionsSvx(obj: ObjectLiteralExpression): boolean {
  const existing = obj.getProperty("extensions");
  if (!existing) {
    obj.addPropertyAssignment({
      name: "extensions",
      initializer: "['.svelte', '.svx']",
    });
    return true;
  }
  if (existing.getKind() !== SyntaxKind.PropertyAssignment) return false;
  const init = (
    existing as import("ts-morph").PropertyAssignment
  ).getInitializer();
  if (!init || init.getKind() !== SyntaxKind.ArrayLiteralExpression) {
    (existing as import("ts-morph").PropertyAssignment).setInitializer(
      "['.svelte', '.svx']",
    );
    return true;
  }
  const arr = init as ArrayLiteralExpression;
  const hasSvx = arr
    .getElements()
    .some((el) => el.getText().replace(/['"`]/g, "") === ".svx");
  if (hasSvx) return false;
  arr.addElement("'.svx'");
  return true;
}

function ensurePreprocessMdsvex(obj: ObjectLiteralExpression): boolean {
  const existing = obj.getProperty("preprocess");
  if (!existing) {
    obj.addPropertyAssignment({
      name: "preprocess",
      initializer: "[mdsvex()]",
    });
    return true;
  }
  if (existing.getKind() !== SyntaxKind.PropertyAssignment) return false;
  const init = (
    existing as import("ts-morph").PropertyAssignment
  ).getInitializer();
  if (!init) {
    (existing as import("ts-morph").PropertyAssignment).setInitializer(
      "[mdsvex()]",
    );
    return true;
  }
  if (init.getKind() === SyntaxKind.ArrayLiteralExpression) {
    const arr = init as ArrayLiteralExpression;
    const hasMdsvex = arr
      .getElements()
      .some((el) => /\bmdsvex\s*\(/.test(el.getText()));
    if (hasMdsvex) return false;
    arr.addElement("mdsvex()");
    return true;
  }
  const text = init.getText();
  if (/\bmdsvex\s*\(/.test(text)) return false;
  (existing as import("ts-morph").PropertyAssignment).setInitializer(
    `[${text}, mdsvex()]`,
  );
  return true;
}

/**
 * Enable mdsvex: ensure `extensions` includes `.svx`, `preprocess` includes
 * `mdsvex()`, and the `mdsvex` import is present. All root-level, so they apply
 * identically to svelte.config and the inline sveltekit() arg; the import lands
 * in whichever file was resolved.
 */
export function modifySvelteConfigMdsvex(root: string): ConfigModifyResult {
  return modifyConfig(
    root,
    { notFound: NOT_FOUND_HINT, failed: FAILURE_HINT },
    (target) => {
      ensureExtensionsSvx(target.configObject);
      ensurePreprocessMdsvex(target.configObject);
      ensureImports(target.sourceFile, [
        { namedImports: ["mdsvex"], moduleSpecifier: "mdsvex" },
      ]);
      return true;
    },
  );
}
