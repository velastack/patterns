import fs from "node:fs";
import dedent from "dedent";
import { Node, SyntaxKind, type CallExpression } from "ts-morph";
import { SvelteFile } from "../../../../runtime/svelte-file";
import {
  ensureImports,
  withInMemoryScript,
} from "../../../../runtime/ts-morph-helpers";
import type { ModifyOutcome } from "../../../../core/types";

export const MODULE_SPECIFIER = "#lib/og/index.js";

const HINT = [
  "Pass the meta tags the root src/routes/+layout.svelte renders through withCard.",
  "",
  'Imports for the <script lang="ts"> tag:',
  "",
  dedent`
    import { page } from '$app/state';
    import { withCard } from '${MODULE_SPECIFIER}';
  `,
  "",
  "Then wrap what <MetaTags> is given:",
  "",
  "let metaTags = $derived(withCard(deepMerge(data.baseMetaTags, page.data.pageMetaTags), page.url));",
].join("\n");

/** The `$derived(...)` call that `let metaTags = ...` is initialised with. */
export function findMetaTagsDerived(
  sf: import("ts-morph").SourceFile,
): CallExpression | null {
  const declaration = sf
    .getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((d) => d.getName() === "metaTags");
  const init = declaration?.getInitializer();
  if (!init || !Node.isCallExpression(init)) return null;
  if (init.getExpression().getText() !== "$derived") return null;
  return init.getArguments().length === 1 ? init : null;
}

/**
 * Wraps the root layout's `metaTags` in `withCard(..., page.url)`, which swaps
 * the site-wide `/og.jpg` for the page's generated card. Vela's templates all
 * build `metaTags` the same way; a layout that does not gets the snippet to
 * paste instead.
 */
export function modifyLayoutSvelte(layoutPath: string): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "not-found", message: HINT };
  }

  const file = SvelteFile.fromPath(layoutPath);
  const script = file.getScript();
  if (!script) return { status: "failed", message: HINT };
  if (script.content.includes("withCard(")) {
    return { status: "success", changed: false };
  }

  let wrapped = false;
  file.modifyScript((source) => {
    const { source: out } = withInMemoryScript(source, (sf) => {
      const derived = findMetaTagsDerived(sf);
      if (!derived) return;
      const [arg] = derived.getArguments();
      arg.replaceWithText(`withCard(${arg.getText()}, page.url)`);
      wrapped = true;
      ensureImports(sf, [
        { namedImports: ["page"], moduleSpecifier: "$app/state" },
        { namedImports: ["withCard"], moduleSpecifier: MODULE_SPECIFIER },
      ]);
    });
    return wrapped ? out : source;
  });

  if (!wrapped) return { status: "failed", message: HINT };
  file.writeTo(layoutPath);
  return { status: "success", changed: file.hasChanged() };
}
