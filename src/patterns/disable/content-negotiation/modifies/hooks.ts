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
      ni.getName() === "reroute" &&
      ni.getAliasNode()?.getText() === "negotiateReroute"
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

function isMeaningfullyEmpty(sourceFile: SourceFile): boolean {
  return sourceFile
    .getStatements()
    .every((s) => s.getKind() === SyntaxKind.EmptyStatement);
}

export function unmodifyHooksNegotiate(hooksPath: string): ModifyOutcome {
  if (!fs.existsSync(hooksPath)) {
    return { status: "success", changed: false };
  }

  const original = fs.readFileSync(hooksPath, "utf8");
  if (!original.includes("negotiateReroute")) {
    return { status: "success", changed: false };
  }

  const project = new Project({
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.addSourceFileAtPath(hooksPath);

  const rerouteDecl = sourceFile.getVariableDeclaration("reroute");
  const init = rerouteDecl?.getInitializer();
  const initText = init?.getText() ?? "";

  const hasI18nHelper = sourceFile
    .getVariableDeclarations()
    .some((d) => d.getName() === "rerouteDeLocalize");

  if (
    rerouteDecl &&
    hasI18nHelper &&
    initText.includes("rerouteDeLocalize") &&
    initText.includes("negotiateReroute")
  ) {
    rerouteDecl.setInitializer("({ url }) => rerouteDeLocalize(url.pathname)");
  } else if (rerouteDecl && initText.includes("negotiateReroute")) {
    const stmt = rerouteDecl.getFirstAncestorByKind(
      SyntaxKind.VariableStatement,
    );
    stmt?.remove();
  }

  removeNegotiateImport(sourceFile);

  if (isMeaningfullyEmpty(sourceFile)) {
    fs.rmSync(hooksPath, { force: true });
    return { status: "success", changed: true };
  }

  sourceFile.formatText();
  sourceFile.saveSync();
  return {
    status: "success",
    changed: sourceFile.getFullText() !== original,
  };
}
