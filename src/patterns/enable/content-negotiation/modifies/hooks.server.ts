import fs from "node:fs";
import path from "node:path";
import dedent from "dedent";
import { Project, QuoteKind, type SourceFile } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import { addHandle } from "../../../../runtime/compose-handle";
import { formatLikeSource } from "../../../../runtime/ts-morph-helpers";

const FAILURE_HINT = dedent`
  Wrap your exported handle with the negotiation handler:

  import { sequence } from '@sveltejs/kit/hooks';
  import { handle as handleNegotiate } from '$lib/negotiate';

  export const handle = sequence(handleNegotiate, /* your existing handle */);
`;

const HOOKS_SERVER_SNIPPET = dedent`
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
  formatLikeSource(sourceFile);
  sourceFile.saveSync();
  return {
    status: "success",
    changed: sourceFile.getFullText() !== original,
  };
}
