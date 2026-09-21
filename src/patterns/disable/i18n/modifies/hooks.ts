import fs from "node:fs";
import dedent from "dedent";
import { Project, QuoteKind, SyntaxKind } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import {
  ensureBlankLineAfterImports,
  isEffectivelyEmpty,
  pruneUnusedImports,
  removeTopLevelStatementByIdentifier,
  formatLikeSource,
} from "../../../../runtime/ts-morph-helpers";

const DELOCALIZE_HELPER = "rerouteDeLocalize";

const FAILURE_HINT = dedent`
  Take rerouteDeLocalize out of the exported reroute in src/hooks.ts, then
  remove its declaration and the wuchale and $locales imports.
`;

const I18N_MODULES = ["wuchale/url", "$locales/main.url", "$locales/data"];

/** The two reroutes `modifyHooksI18n` writes: on its own, and composed. */
const I18N_ONLY_REROUTE =
  /^\(\s*\{\s*url\s*\}\s*\)\s*=>\s*rerouteDeLocalize\(\s*url\.pathname\s*\)$/;
const COMPOSED_REROUTE =
  /^\(\s*\{\s*url\s*\}\s*\)\s*=>\s*rerouteDeLocalize\(\s*negotiateReroute\(\s*url\.pathname\s*\)\s*\)$/;

/**
 * Undo `modifyHooksI18n`: drop the de-localizer and its imports, leaving the
 * negotiation reroute it may have been composed with. A file that enable-i18n
 * created comes out empty, for the caller to delete.
 */
export function unmodifyHooksI18n(hooksPath: string): ModifyOutcome {
  if (!fs.existsSync(hooksPath)) {
    return { status: "success", changed: false };
  }

  const original = fs.readFileSync(hooksPath, "utf8");
  if (!original.includes(DELOCALIZE_HELPER)) {
    return { status: "success", changed: false };
  }

  const project = new Project({
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.addSourceFileAtPath(hooksPath);

  const helperStatement = sourceFile
    .getVariableDeclaration(DELOCALIZE_HELPER)
    ?.getFirstAncestorByKind(SyntaxKind.VariableStatement);

  const rerouteDecl = sourceFile.getVariableDeclaration("reroute");
  const initText = rerouteDecl?.getInitializer()?.getText() ?? "";
  const composed = COMPOSED_REROUTE.test(initText);
  const rerouteStatement =
    composed || I18N_ONLY_REROUTE.test(initText)
      ? rerouteDecl?.getFirstAncestorByKind(SyntaxKind.VariableStatement)
      : undefined;

  // Anything else reading the de-localizer is code enable-i18n did not write,
  // so undoing it is the developer's call.
  const otherReaders = sourceFile
    .getStatements()
    .filter(
      (s) =>
        s !== helperStatement &&
        s !== rerouteStatement &&
        s.getText().includes(DELOCALIZE_HELPER),
    );
  if (otherReaders.length > 0) {
    return { status: "failed", message: FAILURE_HINT };
  }

  if (composed) {
    // content-negotiation's reroute is underneath; it stays.
    rerouteDecl?.setInitializer("({ url }) => negotiateReroute(url.pathname)");
  } else if (rerouteStatement) {
    removeTopLevelStatementByIdentifier(sourceFile, "reroute");
  }

  removeTopLevelStatementByIdentifier(sourceFile, DELOCALIZE_HELPER);
  pruneUnusedImports(sourceFile, I18N_MODULES);

  if (isEffectivelyEmpty(sourceFile)) {
    // Emptied rather than removed: the runtime turns an empty hooks.ts into a
    // delete entry, so the removal is written and reported like any other.
    fs.writeFileSync(hooksPath, "", "utf8");
    return { status: "success", changed: true };
  }

  formatLikeSource(sourceFile);
  ensureBlankLineAfterImports(sourceFile);
  sourceFile.saveSync();
  return {
    status: "success",
    changed: sourceFile.getFullText() !== original,
  };
}
