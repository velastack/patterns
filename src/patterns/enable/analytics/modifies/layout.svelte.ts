import fs from "node:fs";
import dedent from "dedent";
import { SvelteFile } from "../../../../runtime/svelte-file";
import {
  ensureImports,
  withInMemoryScript,
} from "../../../../runtime/ts-morph-helpers";
import type { ModifyOutcome } from "../../../../core/types";

const MODULE_SPECIFIER = "$lib/components/analytics/analytics.svelte";

const IMPORT_SNIPPET = dedent`
  import Analytics from '${MODULE_SPECIFIER}';
`;

const MARKUP_SNIPPET = "\n<Analytics />\n";

const NOT_FOUND_HINT = [
  "Create the root src/routes/+layout.svelte and mount <Analytics /> inside it.",
  "",
  "Import for the <script> tag:",
  "",
  IMPORT_SNIPPET,
  "",
  "Markup to add at the top level of the layout, above {@render children()}:",
  MARKUP_SNIPPET.trim(),
].join("\n");

const FAILURE_HINT = [
  "Mount <Analytics /> in the root src/routes/+layout.svelte.",
  "",
  'Import for a <script lang="ts"> tag:',
  "",
  IMPORT_SNIPPET,
  "",
  "Markup to add at the top level of the layout, above {@render children()}:",
  MARKUP_SNIPPET.trim(),
].join("\n");

/**
 * Mounts `<Analytics />` at the top level of the root layout, ahead of
 * `{@render children()}`. The component is the same path for every provider,
 * so this modifier is provider-agnostic and a re-run with another provider
 * leaves the layout alone.
 */
export function modifyLayoutSvelte(layoutPath: string): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const file = SvelteFile.fromPath(layoutPath);
  if (file.hasElement("Analytics")) {
    return { status: "success", changed: false };
  }
  if (!file.getScript()) {
    return { status: "failed", message: FAILURE_HINT };
  }

  file.modifyScript((source) => {
    const { source: out } = withInMemoryScript(source, (sf) => {
      ensureImports(sf, [
        { defaultImport: "Analytics", moduleSpecifier: MODULE_SPECIFIER },
      ]);
    });
    return out;
  });

  if (!file.insertBeforeChildren(MARKUP_SNIPPET)) {
    file.appendMarkup(MARKUP_SNIPPET);
  }
  file.writeTo(layoutPath);
  return { status: "success", changed: file.hasChanged() };
}
