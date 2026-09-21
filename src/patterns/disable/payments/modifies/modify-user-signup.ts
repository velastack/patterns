import fs from "node:fs";
import { Project, QuoteKind, SyntaxKind } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import { formatLikeSource } from "../../../../runtime/ts-morph-helpers";

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

  for (const specifier of [
    "$lib/workflows/link-stripe-customer",
    "$lib/stripe",
  ]) {
    const decl = sourceFile
      .getImportDeclarations()
      .find((d) => d.getModuleSpecifierValue() === specifier);
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
    if (stmt) stmt.remove();
  }

  formatLikeSource(sourceFile);
  sourceFile.saveSync();

  return {
    status: "success",
    changed: sourceFile.getFullText() !== originalSource,
  };
}
