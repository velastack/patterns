import fs from "node:fs";
import dedent from "dedent";
import { Node, Project, QuoteKind } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import { replaceHandle } from "../../../../runtime/compose-handle";
import {
  ensureBlankLineAfterImports,
  ensureNamedImport,
  pruneUnusedImports,
  formatLikeSource,
} from "../../../../runtime/ts-morph-helpers";

/** The handle `creates/src/hooks.server.ts` exports, for a file that already exists. */
export const POCKETBASE_HANDLE = dedent`
  handlePocketbase({
  	pocketbaseUrl: env.POCKETBASE_URL,
  	superuserEmail: env.POCKETBASE_SUPERUSER_EMAIL,
  	superuserPassword: env.POCKETBASE_SUPERUSER_PASSWORD
  })
`;

const FAILURE_HINT = dedent`
  Add the PocketBase handle to the exported handle in src/hooks.server.ts:

  import { sequence } from '@sveltejs/kit/hooks';
  import { env } from '$env/dynamic/private';
  import { handlePocketbase } from '@velastack/pocketbase';

  export const handle = sequence(
  	/* your existing handle */,
  	${POCKETBASE_HANDLE.replace(/\n/g, "\n\t")}
  );
`;

/**
 * Compose the PocketBase handle into a `hooks.server.ts` the project already
 * has, instead of the create overwriting it: a static site's, or one i18n or
 * content negotiation wrote. It takes `handleStatic()`'s place, since
 * `handlePocketbase` does what that did and more; otherwise it goes last, so
 * the handles already there keep running first.
 */
export function modifyHooksServerBackend(
  hooksServerPath: string,
): ModifyOutcome {
  if (!fs.existsSync(hooksServerPath)) {
    // The create writes it.
    return { status: "success", changed: false };
  }

  const original = fs.readFileSync(hooksServerPath, "utf8");
  const project = new Project({
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.addSourceFileAtPath(hooksServerPath);

  const composed = replaceHandle(sourceFile, "handleStatic", {
    expression: POCKETBASE_HANDLE,
    name: "handlePocketbase",
    position: "last",
  });
  if (composed.status === "unsupported") {
    return { status: "failed", message: FAILURE_HINT };
  }
  if (composed.status === "unchanged") {
    return { status: "success", changed: false };
  }

  // The static template's comment explains handleStatic(). Where that was the
  // whole handle, replaceHandle already dropped it; in a sequence (i18n or
  // negotiation composed in since) it is still there, describing a handle
  // that is gone.
  const statement = composed.statement;
  if (statement && Node.isJSDocable(statement)) {
    for (const doc of statement.getJsDocs()) {
      if (doc.getText().includes("vela legal")) doc.remove();
    }
  }

  pruneUnusedImports(sourceFile, ["@velastack/kit"]);
  ensureNamedImport(sourceFile, "$env/dynamic/private", "env");
  ensureNamedImport(sourceFile, "@velastack/pocketbase", "handlePocketbase");

  formatLikeSource(sourceFile);
  ensureBlankLineAfterImports(sourceFile);
  sourceFile.saveSync();
  return {
    status: "success",
    changed: sourceFile.getFullText() !== original,
  };
}
