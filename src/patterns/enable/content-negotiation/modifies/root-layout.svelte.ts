import fs from "node:fs";
import dedent from "dedent";
import { SvelteFile } from "../../../../runtime/svelte-file";
import {
  ensureImports,
  withInMemoryScript,
} from "../../../../runtime/ts-morph-helpers";
import type { ModifyOutcome } from "../../../../core/types";

const IMPORT_SNIPPET = dedent`
  import { Negotiate } from '$lib/negotiate';
`;

const MARKUP_SNIPPET = "\n<Negotiate />\n";

const NOT_FOUND_HINT = [
  "Create the root +layout.svelte and mount <Negotiate /> inside it.",
  "",
  "Import for the <script> tag:",
  "",
  IMPORT_SNIPPET,
  "",
  "Markup to add at the top level of the layout:",
  MARKUP_SNIPPET.trim(),
].join("\n");

export function modifyRootLayoutNegotiate(layoutPath: string): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const file = SvelteFile.fromPath(layoutPath);
  if (file.hasElement("Negotiate")) {
    return { status: "success", changed: false };
  }

  file.modifyScript((source) => {
    const { source: out } = withInMemoryScript(source, (sf) => {
      ensureImports(sf, [
        {
          namedImports: ["Negotiate"],
          moduleSpecifier: "$lib/negotiate",
        },
      ]);
    });
    return out;
  });

  file.appendMarkup(MARKUP_SNIPPET);
  file.writeTo(layoutPath);
  return { status: "success", changed: file.hasChanged() };
}
