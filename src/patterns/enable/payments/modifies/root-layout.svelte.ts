import fs from "node:fs";
import dedent from "dedent";
import type { ModifyOutcome } from "../../../../core/types";
import { SvelteFile } from "../../../../runtime/svelte-file";
import { libModule } from "../../../../runtime/lib-specifier";
import {
  ensureBlankLineAfterImports,
  ensureImports,
  removeImportByModuleSpecifier,
  withInMemoryScript,
} from "../../../../runtime/ts-morph-helpers";

/** The item, indented like the list it joins; `indent` is the list's closing tag's. */
function snippet(indent: string): string {
  return `<Navbar.Item>\n${indent}\t<CurrencySelect />\n${indent}</Navbar.Item>\n${indent}`;
}

const SNIPPET = snippet("\t\t\t");

const IMPORT = dedent`
  import CurrencySelect from '#lib/components/currency-select.svelte';
`;

const FAILURE_HINT = [
  "Add the currency select inside your <Navbar.List> in the root layout.",
  "",
  "Import to add to the <script> tag:",
  "",
  IMPORT,
  "",
  "Markup to add at the end of <Navbar.List>, after the language select if there is one:",
  SNIPPET,
].join("\n");

const NOT_FOUND_HINT = [
  "Create a root layout that includes a currency select inside <Navbar.List>.",
  "",
  "Import for the <script> tag:",
  "",
  IMPORT,
  "",
  "Markup at the end of <Navbar.List>:",
  SNIPPET,
].join("\n");

/**
 * The currency select goes in the navbar beside the language select, when
 * there is one, else as the last item. It renders nothing until the business
 * offers a second currency, so the layout gains it with payments.
 */
export function modifyRootLayoutCurrencySelect(
  layoutPath: string,
): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }
  const file = SvelteFile.fromPath(layoutPath);
  if (file.hasElement("CurrencySelect")) {
    return { status: "success", changed: false };
  }
  if (!file.hasElement("Navbar.List")) {
    return { status: "failed", message: FAILURE_HINT };
  }
  const language = file.findElementContaining("Navbar.Item", "LanguageSelect");
  if (language) {
    // On the line after the language select's item; the helper indents it.
    file.insertAfterElement(
      language,
      "<Navbar.Item>\n\t<CurrencySelect />\n</Navbar.Item>",
    );
  } else {
    // The closing tag's own indentation already precedes the insertion point,
    // so the item starts one level in and hands that indentation back.
    const indent =
      /^([ \t]*)<\/Navbar\.List>/m.exec(file.toString())?.[1] ?? "\t\t";
    const item = `\t<Navbar.Item>\n${indent}\t\t<CurrencySelect />\n${indent}\t</Navbar.Item>\n${indent}`;
    if (!file.insertBeforeClosingTag("Navbar.List", item))
      return { status: "failed", message: FAILURE_HINT };
  }
  file.modifyScript((source) => {
    const { source: out } = withInMemoryScript(source, (sf) => {
      ensureImports(sf, [
        {
          defaultImport: "CurrencySelect",
          moduleSpecifier: "#lib/components/currency-select.svelte",
        },
      ]);
    });
    return out;
  });
  file.writeTo(layoutPath);
  return { status: "success", changed: file.hasChanged() };
}

/** Take the currency select (and the nav item around it) back out. */
export function unmodifyRootLayoutCurrencySelect(
  layoutPath: string,
): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "success", changed: false };
  }
  const original = fs.readFileSync(layoutPath, "utf8");
  if (!original.includes("CurrencySelect")) {
    return { status: "success", changed: false };
  }
  const file = SvelteFile.fromPath(layoutPath);
  file.modifyScript((source) => {
    const { source: out } = withInMemoryScript(source, (sf) => {
      removeImportByModuleSpecifier(
        sf,
        libModule("components/currency-select.svelte"),
      );
      ensureBlankLineAfterImports(sf);
    });
    return out;
  });
  let updated = file.toString();
  updated = updated.replace(
    /[ \t]*<Navbar\.Item>\s*<CurrencySelect\s*\/>\s*<\/Navbar\.Item>[ \t]*\r?\n?/g,
    "",
  );
  updated = updated.replace(/[ \t]*<CurrencySelect\s*\/>[ \t]*\r?\n?/g, "");
  fs.writeFileSync(layoutPath, updated, "utf8");
  return { status: "success", changed: updated !== original };
}
