import fs from "node:fs";
import dedent from "dedent";
import { SvelteFile } from "../../../../runtime/svelte-file";
import {
  ensureImports,
  withInMemoryScript,
} from "../../../../runtime/ts-morph-helpers";
import type { ModifyOutcome } from "../../../../core/types";

const IMPORT_SNIPPET = dedent`
  import { AdminBar } from '@velastack/cms';
`;

const MARKUP_SNIPPET = "\n<AdminBar />\n";

const NOT_FOUND_HINT = [
  "Create the root src/routes/+layout.svelte and mount <AdminBar /> inside it.",
  "",
  "Import for the <script> tag:",
  "",
  IMPORT_SNIPPET,
  "",
  "Markup to add at the top level of the layout, above {@render children()}:",
  MARKUP_SNIPPET.trim(),
].join("\n");

const FAILURE_HINT = [
  "Mount <AdminBar /> in the root src/routes/+layout.svelte.",
  "",
  'Import for a <script lang="ts"> tag:',
  "",
  IMPORT_SNIPPET,
  "",
  "Markup to add at the top level of the layout, above {@render children()}:",
  MARKUP_SNIPPET.trim(),
].join("\n");

/**
 * Mounts `<AdminBar />` at the top level of the root layout, ahead of
 * `{@render children()}` so the bar is in the DOM before the page content.
 * Falls back to appending when the layout has no render tag or slot.
 */
export function modifyLayoutSvelte(layoutPath: string): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const file = SvelteFile.fromPath(layoutPath);
  if (file.hasElement("AdminBar")) {
    return { status: "success", changed: false };
  }
  if (!file.getScript()) {
    return { status: "failed", message: FAILURE_HINT };
  }

  file.modifyScript((source) => {
    const { source: out } = withInMemoryScript(source, (sf) => {
      ensureImports(sf, [
        { namedImports: ["AdminBar"], moduleSpecifier: "@velastack/cms" },
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
