import fs from "node:fs";
import path from "node:path";
import dedent from "dedent";
import { Project, QuoteKind } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import { addHandle, removeHandle } from "../../../../runtime/compose-handle";
import { libModule } from "../../../../runtime/lib-specifier";
import {
  ensureBlankLineAfterImports,
  ensureNamedImport,
  formatLikeSource,
  removeNamedImportIfUnused,
} from "../../../../runtime/ts-morph-helpers";

const HANDLE = "handleCurrency";
const MODULE = "#lib/currency.server.js";

const FAILURE_HINT = dedent`
  Compose the currency handle into your exported handle:

  import { sequence } from '@sveltejs/kit/hooks';
  import { handleCurrency } from '#lib/currency.server.js';

  export const handle = sequence(handleCurrency, /* your existing handle */);
`;

const HOOKS_SERVER_SNIPPET = dedent`
  import { handleCurrency } from '#lib/currency.server.js';

  export const handle = handleCurrency;
`;

function project(): Project {
  return new Project({
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
}

/**
 * `handleCurrency` joins the server handle chain so every request knows the
 * currency its visitor reads prices in. Creates `hooks.server.ts` when the
 * project has none.
 */
export function modifyHooksServerCurrency(
  hooksServerPath: string,
): ModifyOutcome {
  if (!fs.existsSync(hooksServerPath)) {
    // SvelteKit loads the first `hooks.server.*` it finds, and `.js` sorts
    // first, so a new `.ts` beside it would never run.
    if (fs.existsSync(hooksServerPath.replace(/\.ts$/, ".js"))) {
      return { status: "failed", message: FAILURE_HINT };
    }
    fs.mkdirSync(path.dirname(hooksServerPath), { recursive: true });
    fs.writeFileSync(hooksServerPath, HOOKS_SERVER_SNIPPET + "\n");
    return { status: "success", changed: true };
  }

  const original = fs.readFileSync(hooksServerPath, "utf8");
  if (original.includes(HANDLE)) return { status: "success", changed: false };

  const sourceFile = project().addSourceFileAtPath(hooksServerPath);
  // Composed first: an unsupported handle leaves the file untouched.
  const composed = addHandle(sourceFile, { expression: HANDLE });
  if (composed.status === "unsupported") {
    return { status: "failed", message: FAILURE_HINT };
  }
  ensureNamedImport(sourceFile, MODULE, HANDLE);
  formatLikeSource(sourceFile);
  const updated = sourceFile.getFullText();
  fs.writeFileSync(hooksServerPath, updated, "utf8");
  return { status: "success", changed: updated !== original };
}

/** Take `handleCurrency` back out of the chain, and its import with it. */
export function unmodifyHooksServerCurrency(
  hooksServerPath: string,
): ModifyOutcome {
  if (!fs.existsSync(hooksServerPath)) {
    return { status: "success", changed: false };
  }
  const original = fs.readFileSync(hooksServerPath, "utf8");
  if (!original.includes(HANDLE)) return { status: "success", changed: false };

  const sourceFile = project().addSourceFileAtPath(hooksServerPath);
  const removed = removeHandle(sourceFile, HANDLE);
  if (removed.status === "unsupported") {
    return {
      status: "failed",
      message: `Remove ${HANDLE} from the handle chain in src/hooks.server.ts and its import from '${MODULE}'.`,
    };
  }
  removeNamedImportIfUnused(
    sourceFile,
    libModule("currency.server.js"),
    HANDLE,
  );
  ensureBlankLineAfterImports(sourceFile);
  formatLikeSource(sourceFile);
  const updated = sourceFile.getFullText();
  fs.writeFileSync(hooksServerPath, updated, "utf8");
  return { status: "success", changed: updated !== original };
}
