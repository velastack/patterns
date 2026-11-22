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

// Curly quotes and dashes, which mdsvex 0.x rendered by default.
const MDSVEX_CALL = "mdsvex({ smart_punctuation: true })";

const FAILURE_HINT = dedent`
  Enable mdsvex in your vite.config, ahead of sveltekit():

  import { mdsvex } from 'mdsvex';

  // ...
  plugins: [
    ${MDSVEX_CALL},
    sveltekit({ extensions: ['.svelte', '.svx'] }),
  ],

  mdsvex 1 is a Vite plugin. If mdsvex() is under preprocess, remove it there
  and run \`npx @mdsvex/migrate\` on your existing documents.
`;

const NOT_FOUND_HINT = dedent`
  Enable mdsvex by adding its plugin ahead of sveltekit() in vite.config.ts:

  import { sveltekit } from '@sveltejs/kit/vite';
  import { mdsvex } from 'mdsvex';
  import { defineConfig } from 'vite';

  export default defineConfig({
    plugins: [
      ${MDSVEX_CALL},
      sveltekit({ extensions: ['.svelte', '.svx'] }),
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

/**
 * Put `mdsvex(...)` in the plugin list ahead of `sveltekit()`. False when the
 * list can't be edited, or when mdsvex is still a preprocessor as in 0.x:
 * adding the plugin beside it would leave a config mdsvex 1 can't run.
 */
function ensureMdsvexPlugin(obj: ObjectLiteralExpression): boolean {
  const preprocess = obj.getProperty("preprocess");
  if (preprocess && /\bmdsvex\s*\(/.test(preprocess.getText())) return false;

  const call = obj.getParentIfKind(SyntaxKind.CallExpression);
  const plugins = call?.getParentIfKind(SyntaxKind.ArrayLiteralExpression);
  if (!call || !plugins) return false;

  const elements = plugins.getElements();
  if (elements.some((el) => /^mdsvex\s*\(/.test(el.getText()))) return true;
  plugins.insertElement(elements.indexOf(call), MDSVEX_CALL);
  return true;
}

/**
 * Enable mdsvex: ensure the Vite plugin sits ahead of `sveltekit()`, its
 * `extensions` include `.svx`, and the `mdsvex` import is present.
 */
export function modifyViteConfigMdsvex(root: string): ConfigModifyResult {
  return modifyConfig(
    root,
    { notFound: NOT_FOUND_HINT, failed: FAILURE_HINT },
    (target) => {
      if (!ensureMdsvexPlugin(target.configObject)) return false;
      ensureExtensionsSvx(target.configObject);
      ensureImports(target.sourceFile, [
        { namedImports: ["mdsvex"], moduleSpecifier: "mdsvex" },
      ]);
      return true;
    },
  );
}
