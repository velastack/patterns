import fs from "node:fs";
import { Project, QuoteKind, SyntaxKind, type SourceFile } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";

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

function removeSequenceImportIfUnused(sourceFile: SourceFile): void {
  const decl = sourceFile
    .getImportDeclarations()
    .find((d) => d.getModuleSpecifierValue() === "@sveltejs/kit/hooks");
  if (!decl) return;

  const stillReferenced = sourceFile
    .getDescendantsOfKind(SyntaxKind.Identifier)
    .some((id) => {
      if (id.getText() !== "sequence") return false;
      const parent = id.getParent();
      const kind = parent?.getKind();
      return (
        kind !== SyntaxKind.ImportSpecifier && kind !== SyntaxKind.ImportClause
      );
    });

  if (stillReferenced) return;

  const named = decl
    .getNamedImports()
    .find((ni) => ni.getName() === "sequence");
  if (!named) return;

  if (decl.getNamedImports().length === 1 && !decl.getDefaultImport()) {
    decl.remove();
  } else {
    named.remove();
  }
}

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

  const handleDecl = sourceFile.getVariableDeclaration("handle");
  if (!handleDecl) {
    removeNegotiateImport(sourceFile);
    removeSequenceImportIfUnused(sourceFile);
    sourceFile.formatText();
    sourceFile.saveSync();
    return {
      status: "success",
      changed: sourceFile.getFullText() !== original,
    };
  }

  const init = handleDecl.getInitializer();
  if (init?.getKind() === SyntaxKind.CallExpression) {
    const call = init.asKindOrThrow(SyntaxKind.CallExpression);
    if (call.getExpression().getText() === "sequence") {
      const args = call.getArguments();
      const idx = args.findIndex((arg) => arg.getText() === "handleNegotiate");
      if (idx >= 0) {
        if (args.length === 2) {
          const keepText = args[idx === 0 ? 1 : 0].getText();
          handleDecl.setInitializer(keepText);
        } else {
          call.removeArgument(idx);
        }
      }
    }
  }

  removeNegotiateImport(sourceFile);
  removeSequenceImportIfUnused(sourceFile);
  sourceFile.formatText();
  sourceFile.saveSync();

  return {
    status: "success",
    changed: sourceFile.getFullText() !== original,
  };
}
