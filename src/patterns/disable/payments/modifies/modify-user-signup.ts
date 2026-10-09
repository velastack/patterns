import fs from "node:fs";
import { Project, QuoteKind, SyntaxKind } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import {
  ensureBlankLineAfterImports,
  formatLikeSource,
  removeStatementWithComments,
} from "../../../../runtime/ts-morph-helpers";
import { isLibSpecifier } from "../../../../runtime/lib-specifier";

const CALL_EXPRESSIONS = new Set([
  "linkStripeCustomer.run",
  // Projects from before the workflow: an inline helper called directly.
  "linkStripeCustomer",
]);

export function unmodifyUserSignup(userSignupPath: string): ModifyOutcome {
  if (!fs.existsSync(userSignupPath)) {
    return { status: "success", changed: false };
  }

  const originalSource = fs.readFileSync(userSignupPath, "utf8");
  if (!originalSource.includes("linkStripeCustomer")) {
    return { status: "success", changed: false };
  }

  const project = new Project({
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.addSourceFileAtPath(userSignupPath);

  for (const module of ["workflows/link-stripe-customer", "stripe"]) {
    const decl = sourceFile
      .getImportDeclarations()
      .find((d) => isLibSpecifier(d.getModuleSpecifierValue(), module));
    if (decl) decl.remove();
  }

  const linkFn = sourceFile.getVariableStatement((s) =>
    s.getDeclarations().some((d) => d.getName() === "linkStripeCustomer"),
  );
  if (linkFn) linkFn.remove();

  const callStatements = sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((ce) => CALL_EXPRESSIONS.has(ce.getExpression().getText()));
  for (const call of callStatements) {
    const stmt = call.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
    // With the two comment lines enable-payments put above it: left behind,
    // they keep the file from matching the stock signup, and enable-whatsapp
    // then refuses to swap it.
    if (stmt) removeStatementWithComments(sourceFile, stmt);
  }

  formatLikeSource(sourceFile);
  ensureBlankLineAfterImports(sourceFile);
  sourceFile.saveSync();

  return {
    status: "success",
    changed: sourceFile.getFullText() !== originalSource,
  };
}
