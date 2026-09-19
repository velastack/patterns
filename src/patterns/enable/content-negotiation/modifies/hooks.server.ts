import fs from "node:fs";
import dedent from "dedent";
import { Project, QuoteKind, type SourceFile } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import { addHandle } from "../../../../runtime/compose-handle";

const FAILURE_HINT = dedent`
  Wrap your exported handle with the negotiation handler:

  import { sequence } from '@sveltejs/kit/hooks';
  import { handle as handleNegotiate } from '$lib/negotiate';

  export const handle = sequence(handleNegotiate, /* your existing handle */);
`;

const NOT_FOUND_HINT = dedent`
  Create src/hooks.server.ts with a negotiation handle:

  import { handle as handleNegotiate } from '$lib/negotiate';

  export const handle = handleNegotiate;
`;

function ensureNegotiateHandleImport(sourceFile: SourceFile) {
  const existing = sourceFile
    .getImportDeclarations()
    .find((d) => d.getModuleSpecifierValue() === "$lib/negotiate");
  if (existing) {
    const has = existing.getNamedImports().some((ni) => {
      return (
        ni.getName() === "handle" &&
        ni.getAliasNode()?.getText() === "handleNegotiate"
      );
    });
    if (!has)
      existing.addNamedImport({ name: "handle", alias: "handleNegotiate" });
    return;
  }
  sourceFile.addImportDeclaration({
    namedImports: [{ name: "handle", alias: "handleNegotiate" }],
    moduleSpecifier: "$lib/negotiate",
  });
}

export function modifyHooksServerNegotiate(
  hooksServerPath: string,
): ModifyOutcome {
  if (!fs.existsSync(hooksServerPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const original = fs.readFileSync(hooksServerPath, "utf8");
  if (original.includes("handleNegotiate")) {
    return { status: "success", changed: false };
  }

  const project = new Project({
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.addSourceFileAtPath(hooksServerPath);

  const composed = addHandle(sourceFile, { expression: "handleNegotiate" });
  if (composed.status === "unsupported") {
    return { status: "failed", message: FAILURE_HINT };
  }

  ensureNegotiateHandleImport(sourceFile);
  sourceFile.formatText();
  sourceFile.saveSync();
  return {
    status: "success",
    changed: sourceFile.getFullText() !== original,
  };
}
