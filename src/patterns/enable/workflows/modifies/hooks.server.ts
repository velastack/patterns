import fs from "node:fs";
import dedent from "dedent";
import { Project, QuoteKind, type SourceFile } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import { formatLikeSource } from "../../../../runtime/ts-morph-helpers";

const INIT_SNIPPET = dedent`
  // Runs once when the server starts: executes the workflows in src/lib/workflows.
  export const init: ServerInit = () => startWorker();
`;

const FAILURE_HINT = dedent`
  src/hooks.server.ts already exports an init hook. Start the workflow worker from it:

  import { startWorker } from '$lib/server/workflows';

  export const init: ServerInit = async () => {
    await startWorker();
    // ...the rest of your init
  };
`;

const NOT_FOUND_HINT = dedent`
  Create src/hooks.server.ts and start the workflow worker from its init hook:

  import type { ServerInit } from '@sveltejs/kit';
  import { startWorker } from '$lib/server/workflows';

  export const init: ServerInit = () => startWorker();
`;

function ensureNamedImport(
  sourceFile: SourceFile,
  moduleSpecifier: string,
  name: string,
  typeOnly = false,
) {
  const existing = sourceFile
    .getImportDeclarations()
    .find((d) => d.getModuleSpecifierValue() === moduleSpecifier);
  if (!existing) {
    sourceFile.addImportDeclaration({
      isTypeOnly: typeOnly,
      namedImports: [name],
      moduleSpecifier,
    });
    return;
  }
  if (existing.getNamedImports().some((ni) => ni.getName() === name)) return;
  // A declaration that is already `import type` covers the new name; a value
  // import takes the name as an inline `type` specifier.
  existing.addNamedImport(
    typeOnly && !existing.isTypeOnly() ? { name, isTypeOnly: true } : name,
  );
}

function hasInitExport(sourceFile: SourceFile): boolean {
  if (sourceFile.getVariableDeclaration("init")) return true;
  if (sourceFile.getFunction("init")) return true;
  return sourceFile
    .getExportDeclarations()
    .some((d) => d.getNamedExports().some((e) => e.getName() === "init"));
}

/**
 * Adds the `init` hook that starts the workflow worker. Projects created from
 * the base template already have it; this is the upgrade path for older ones.
 */
export function modifyHooksServerWorkflows(
  hooksServerPath: string,
): ModifyOutcome {
  if (!fs.existsSync(hooksServerPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const original = fs.readFileSync(hooksServerPath, "utf8");
  if (original.includes("startWorker")) {
    return { status: "success", changed: false };
  }

  const project = new Project({
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.addSourceFileAtPath(hooksServerPath);

  if (hasInitExport(sourceFile)) {
    return { status: "failed", message: FAILURE_HINT };
  }

  ensureNamedImport(sourceFile, "@sveltejs/kit", "ServerInit", true);
  ensureNamedImport(sourceFile, "$lib/server/workflows", "startWorker");

  // After everything else, so the hook reads as the last thing the server does on start.
  sourceFile.addStatements(`\n${INIT_SNIPPET}`);

  formatLikeSource(sourceFile);
  sourceFile.saveSync();
  return { status: "success", changed: true };
}
