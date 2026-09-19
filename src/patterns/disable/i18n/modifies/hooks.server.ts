import fs from "node:fs";
import { Project, QuoteKind, SyntaxKind } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import {
  ensureBlankLineAfterImports,
  removeImportByModuleSpecifier,
  removeNamedImportIfUnused,
  removeTopLevelStatementByIdentifier,
} from "../../../../runtime/ts-morph-helpers";

const I18N_HANDLE = "handleWuchale";
const I18N_MODULES = [
  "wuchale/load-utils/server",
  "$locales/main.url",
  "$locales/data",
  "$locales/main.loader.server.svelte.js",
  "$locales/js.loader.server.js",
];

/**
 * Undo `modifyHooksServerI18n`: drop the locale bootstrap, the wuchale handle
 * and its imports, and unwrap `sequence(handleWuchale, ...)`. A file that
 * enable-i18n created comes out empty, for the caller to delete.
 */
export function unmodifyHooksServerI18n(
  hooksServerPath: string,
): ModifyOutcome {
  if (!fs.existsSync(hooksServerPath)) {
    return { status: "success", changed: false };
  }

  const original = fs.readFileSync(hooksServerPath, "utf8");
  if (!original.includes(I18N_HANDLE) && !original.includes("loadLocales(")) {
    return { status: "success", changed: false };
  }

  const project = new Project({
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.addSourceFileAtPath(hooksServerPath);

  // loadLocales(...) bootstrap calls, one at a time (removal invalidates siblings).
  for (;;) {
    const stmt = sourceFile
      .getStatements()
      .find(
        (s) =>
          s.getKind() === SyntaxKind.ExpressionStatement &&
          /^loadLocales\s*\(/.test(s.getText()),
      );
    if (!stmt) break;
    stmt.remove();
  }

  const handleDecl = sourceFile.getVariableDeclaration("handle");
  const init = handleDecl?.getInitializer();
  if (init?.getText() === I18N_HANDLE) {
    // `export const handle = handleWuchale`: the i18n handle was the only one.
    removeTopLevelStatementByIdentifier(sourceFile, "handle");
  } else if (handleDecl && init?.getKind() === SyntaxKind.CallExpression) {
    const call = init.asKindOrThrow(SyntaxKind.CallExpression);
    if (call.getExpression().getText() === "sequence") {
      const args = call.getArguments();
      const index = args.findIndex((arg) => arg.getText() === I18N_HANDLE);
      if (index >= 0) {
        if (args.length === 2) {
          handleDecl.setInitializer(args[index === 0 ? 1 : 0].getText());
        } else {
          call.removeArgument(index);
        }
      }
    }
  }

  removeTopLevelStatementByIdentifier(sourceFile, I18N_HANDLE);
  for (const moduleSpecifier of I18N_MODULES) {
    removeImportByModuleSpecifier(sourceFile, moduleSpecifier);
  }
  removeNamedImportIfUnused(sourceFile, "@sveltejs/kit/hooks", "sequence");
  removeNamedImportIfUnused(sourceFile, "@sveltejs/kit", "Handle");

  sourceFile.formatText();
  ensureBlankLineAfterImports(sourceFile);
  sourceFile.saveSync();
  return {
    status: "success",
    changed: sourceFile.getFullText() !== original,
  };
}
