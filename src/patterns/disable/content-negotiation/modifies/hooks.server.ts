import fs from "node:fs";
import dedent from "dedent";
import { Project, QuoteKind, type SourceFile } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import { removeHandle } from "../../../../runtime/compose-handle";
import {
  ensureBlankLineAfterImports,
  removeNamedImportIfUnused,
} from "../../../../runtime/ts-morph-helpers";

const FAILURE_HINT = dedent`
  Take handleNegotiate out of the exported handle in src/hooks.server.ts, then
  remove its import:

  import { handle as handleNegotiate } from '$lib/negotiate';
`;

function removeNegotiateImport(sourceFile: SourceFile): boolean {
  const decl = sourceFile
    .getImportDeclarations()
    .find((d) => d.getModuleSpecifierValue() === "$lib/negotiate");
  if (!decl) return false;

  const named = decl.getNamedImports().find((ni) => {
    return (
      ni.getName() === "handle" &&
      ni.getAliasNode()?.getText() === "handleNegotiate"
    );
  });

  if (!named) return false;

  if (decl.getNamedImports().length === 1 && !decl.getDefaultImport()) {
    decl.remove();
  } else {
    named.remove();
  }
  return true;
}

/**
 * Undo `modifyHooksServerNegotiate`: take `handleNegotiate` out of the
 * exported handle and drop its import. A file that held nothing else comes
 * out empty, for the caller to delete.
 */
export function unmodifyHooksServerNegotiate(
  hooksServerPath: string,
): ModifyOutcome {
  if (!fs.existsSync(hooksServerPath)) {
    return { status: "success", changed: false };
  }

  const original = fs.readFileSync(hooksServerPath, "utf8");
  if (!original.includes("handleNegotiate")) {
    return { status: "success", changed: false };
  }

  const project = new Project({
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.addSourceFileAtPath(hooksServerPath);

  const removed = removeHandle(sourceFile, "handleNegotiate");
  if (removed.status === "unsupported") {
    return { status: "failed", message: FAILURE_HINT };
  }
  removeNegotiateImport(sourceFile);
  removeNamedImportIfUnused(sourceFile, "@sveltejs/kit/hooks", "sequence");
  sourceFile.formatText();
  ensureBlankLineAfterImports(sourceFile);
  sourceFile.saveSync();

  return {
    status: "success",
    changed: sourceFile.getFullText() !== original,
  };
}
