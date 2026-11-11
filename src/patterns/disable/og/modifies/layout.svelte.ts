import fs from "node:fs";
import { Node } from "ts-morph";
import { SvelteFile } from "../../../../runtime/svelte-file";
import {
  ensureBlankLineAfterImports,
  removeImportByModuleSpecifier,
  withInMemoryScript,
} from "../../../../runtime/ts-morph-helpers";
import type { ModifyOutcome } from "../../../../core/types";
import {
  findMetaTagsDerived,
  MODULE_SPECIFIER,
} from "../../../enable/og/modifies/layout.svelte";

/**
 * Takes `withCard(..., page.url)` back off the root layout's `metaTags`, and
 * its import with it. `page` stays imported: the layout used it before.
 */
export function unmodifyLayoutSvelte(layoutPath: string): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "success", changed: false };
  }

  const file = SvelteFile.fromPath(layoutPath);
  if (!file.getScript()?.content.includes("withCard")) {
    return { status: "success", changed: false };
  }

  file.modifyScript((source) => {
    const { source: out } = withInMemoryScript(source, (sf) => {
      const call = findMetaTagsDerived(sf)?.getArguments()[0];
      if (
        call &&
        Node.isCallExpression(call) &&
        call.getExpression().getText() === "withCard"
      ) {
        call.replaceWithText(call.getArguments()[0].getText());
      }
      removeImportByModuleSpecifier(sf, MODULE_SPECIFIER);
      ensureBlankLineAfterImports(sf);
    });
    return out;
  });

  file.writeTo(layoutPath);
  return { status: "success", changed: file.hasChanged() };
}
