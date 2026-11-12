import fs from "node:fs";
import path from "node:path";
import dedent from "dedent";
import { SvelteFile } from "../../../../runtime/svelte-file";
import {
  ensureImports,
  withInMemoryScript,
} from "../../../../runtime/ts-morph-helpers";
import type { ModifyOutcome } from "../../../../core/types";

/** The signed-in layout enable-auth writes, relative to the project root. */
export const APP_LAYOUT_PATH = path.join(
  "src",
  "routes",
  "(app)",
  "+layout.svelte",
);

/** At the end of the header, pushed to its right edge. */
const LANGUAGE_SELECT_SNIPPET = `	<div class="ml-auto px-4">
					<LanguageSelect />
				</div>
			`;

/** What `disable-i18n` takes back out. */
export const APP_LANGUAGE_SELECT =
  /[ \t]*<div class="ml-auto px-4">\s*<LanguageSelect\s*\/>\s*<\/div>[ \t]*\r?\n?/g;

const IMPORT_SNIPPET = dedent`
  import LanguageSelect from '#lib/components/language-select.svelte';
`;

const FAILURE_HINT = [
  "Add the language select to the <header> of the signed-in layout,",
  "src/routes/(app)/+layout.svelte. Signed-in pages have one URL for every",
  "language, so the select is how a visitor changes it there.",
  "",
  "Import to add to the <script> tag:",
  "",
  IMPORT_SNIPPET,
  "",
  "Markup to add at the end of <header>:",
  "",
  '<div class="ml-auto px-4">',
  "  <LanguageSelect />",
  "</div>",
].join("\n");

/**
 * The language select at the end of the signed-in layout's header. Signed-in
 * pages have no language in their URL and no public navbar, so without it a
 * visitor could only change language by going back to a public page.
 *
 * Shared by the two patterns that can be the second one enabled: enable-i18n
 * adds it to the layout enable-auth wrote, and enable-auth adds it to its own
 * layout when the project already has i18n. A project without the layout is
 * left alone.
 */
export function modifyAppLayoutLanguageSelect(
  layoutPath: string,
): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "success", changed: false };
  }

  const file = SvelteFile.fromPath(layoutPath);
  if (file.hasElement("LanguageSelect")) {
    return { status: "success", changed: false };
  }
  if (!file.getScript() || !file.hasElement("header")) {
    return { status: "failed", message: FAILURE_HINT };
  }

  file.modifyScript((source) => {
    const { source: out } = withInMemoryScript(source, (sf) => {
      ensureImports(sf, [
        {
          defaultImport: "LanguageSelect",
          moduleSpecifier: "#lib/components/language-select.svelte",
        },
      ]);
    });
    return out;
  });
  file.insertBeforeClosingTag("header", LANGUAGE_SELECT_SNIPPET);
  file.writeTo(layoutPath);
  return { status: "success", changed: file.hasChanged() };
}
