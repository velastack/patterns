import fs from "node:fs";
import dedent from "dedent";
import { SvelteFile } from "../../../../runtime/svelte-file";
import {
  ensureImports,
  withInMemoryScript,
} from "../../../../runtime/ts-morph-helpers";
import type { ModifyOutcome } from "../../../../core/types";
import type { Ui } from "../../../../core/field/ui";

const LANGUAGE_SELECT_SNIPPET = `<Navbar.Item>
				<LanguageSelect />
			</Navbar.Item>
			`;

const PLAIN_LANGUAGE_SELECT_SNIPPET = "<LanguageSelect />";

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

const PLAIN_FAILURE_HINT = [
  "Add the language select to your root layout.",
  "",
  "Import to add to the <script> tag:",
  "",
  IMPORT_SNIPPET,
  "",
  "Markup to add wherever it should render, e.g. above {@render children()}:",
  "",
  PLAIN_LANGUAGE_SELECT_SNIPPET,
].join("\n");

const PLAIN_NOT_FOUND_HINT = [
  "Create a root layout that includes the language select.",
  "",
  "Import for the <script> tag:",
  "",
  IMPORT_SNIPPET,
  "",
  "Markup above {@render children()}:",
  "",
  PLAIN_LANGUAGE_SELECT_SNIPPET,
].join("\n");

function addImport(file: SvelteFile): void {
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
}

/**
 * A vela layout gets the select as the last `<Navbar.List>` item. A plain one
 * (a project vela did not create) has no navbar, so the select goes above the
 * layout's children.
 */
export function modifyRootLayoutLanguageSelect(
  layoutPath: string,
  ui: Ui = "shadcn",
): ModifyOutcome {
  const plain = ui === "plain";
  if (!fs.existsSync(layoutPath)) {
    return {
      status: "not-found",
      message: plain ? PLAIN_NOT_FOUND_HINT : NOT_FOUND_HINT,
    };
  }

  const file = SvelteFile.fromPath(layoutPath);
  if (file.hasElement("LanguageSelect")) {
    return { status: "success", changed: false };
  }

  if (plain) {
    // Without a <script> the import has nowhere to go, and the markup alone
    // would not compile.
    if (!file.getScript()) {
      return { status: "failed", message: PLAIN_FAILURE_HINT };
    }
    if (!file.insertBeforeChildren(PLAIN_LANGUAGE_SELECT_SNIPPET)) {
      return { status: "failed", message: PLAIN_FAILURE_HINT };
    }
    addImport(file);
    file.writeTo(layoutPath);
    return { status: "success", changed: file.hasChanged() };
  }

  if (!file.hasElement("Navbar.List")) {
    return { status: "failed", message: FAILURE_HINT };
  }

  addImport(file);
  file.insertBeforeClosingTag("Navbar.List", LANGUAGE_SELECT_SNIPPET);
  file.writeTo(layoutPath);
  return { status: "success", changed: file.hasChanged() };
}
