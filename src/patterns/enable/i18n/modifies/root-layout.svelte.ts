import fs from "node:fs";
import dedent from "dedent";
import { SvelteFile } from "../../../../runtime/svelte-file";
import {
  ensureImports,
  withInMemoryScript,
} from "../../../../runtime/ts-morph-helpers";
import type { ModifyOutcome } from "../../../../core/types";

const LANGUAGE_SELECT_SNIPPET = `<Navbar.Item>
				<LanguageSelect />
			</Navbar.Item>
			`;

const IMPORT_SNIPPET = dedent`
  import LanguageSelect from '$lib/components/language-select.svelte';
`;

const FAILURE_HINT = [
  "Add the language select inside your <Navbar.List> in the root layout.",
  "",
  "Import to add to the <script> tag:",
  "",
  IMPORT_SNIPPET,
  "",
  "Markup to add at the end of <Navbar.List>:",
  LANGUAGE_SELECT_SNIPPET,
].join("\n");

const NOT_FOUND_HINT = [
  "Create a root layout that includes a language select inside <Navbar.List>.",
  "",
  "Import for the <script> tag:",
  "",
  IMPORT_SNIPPET,
  "",
  "Markup at the end of <Navbar.List>:",
  LANGUAGE_SELECT_SNIPPET,
].join("\n");

export function modifyRootLayoutLanguageSelect(
  layoutPath: string,
): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const file = SvelteFile.fromPath(layoutPath);
  if (!file.hasElement("Navbar.List")) {
    return { status: "failed", message: FAILURE_HINT };
  }
  if (file.hasElement("LanguageSelect")) {
    return { status: "success", changed: false };
  }

  file.modifyScript((source) => {
    const { source: out } = withInMemoryScript(source, (sf) => {
      ensureImports(sf, [
        {
          defaultImport: "LanguageSelect",
          moduleSpecifier: "$lib/components/language-select.svelte",
        },
      ]);
    });
    return out;
  });

  file.insertBeforeClosingTag("Navbar.List", LANGUAGE_SELECT_SNIPPET);
  file.writeTo(layoutPath);
  return { status: "success", changed: file.hasChanged() };
}
