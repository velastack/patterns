import fs from "node:fs";
import dedent from "dedent";
import { SvelteFile } from "../../../../runtime/svelte-file";
import {
  ensureImports,
  withInMemoryScript,
} from "../../../../runtime/ts-morph-helpers";
import type { ModifyOutcome } from "../../../../core/types";

const BELL_SNIPPET = `
		<div class="ml-auto px-4">
			<NotificationsBell />
		</div>
	`;

const IMPORT_SNIPPET = dedent`
  import NotificationsBell from '$lib/components/notifications-bell.svelte';
`;

const FAILURE_HINT = [
  "Add the notifications bell inside the (app) layout's <header>.",
  "",
  "Imports to add to the <script> tag:",
  "",
  IMPORT_SNIPPET,
  "",
  "Markup to add inside <header>:",
  BELL_SNIPPET,
].join("\n");

const NOT_FOUND_HINT = [
  "Create src/routes/(app)/+layout.svelte with a <header> that includes the bell.",
  "",
  "Imports for the <script> tag:",
  "",
  IMPORT_SNIPPET,
  "",
  "Markup inside <header>:",
  BELL_SNIPPET,
].join("\n");

export function modifyAppLayout(layoutPath: string): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const file = SvelteFile.fromPath(layoutPath);
  if (!file.hasElement("header")) {
    return { status: "failed", message: FAILURE_HINT };
  }
  if (file.hasElement("NotificationsBell")) {
    return { status: "success", changed: false };
  }

  file.modifyScript((source) => {
    const { source: out } = withInMemoryScript(source, (sf) => {
      ensureImports(sf, [
        {
          defaultImport: "NotificationsBell",
          moduleSpecifier: "$lib/components/notifications-bell.svelte",
        },
      ]);
    });
    return out;
  });

  file.insertBeforeClosingTag("header", BELL_SNIPPET);
  file.writeTo(layoutPath);
  return { status: "success", changed: file.hasChanged() };
}
