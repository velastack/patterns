import fs from "node:fs";
import { Project, QuoteKind, SyntaxKind } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";

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

  const stripeImport = sourceFile
    .getImportDeclarations()
    .find((d) => d.getModuleSpecifierValue() === "$lib/stripe");
  if (stripeImport) stripeImport.remove();

  const linkFn = sourceFile.getVariableStatement((s) =>
    s.getDeclarations().some((d) => d.getName() === "linkStripeCustomer"),
  );
  if (linkFn) linkFn.remove();

  const callStatements = sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((ce) => ce.getExpression().getText() === "linkStripeCustomer");
  for (const call of callStatements) {
    const stmt = call.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
    if (stmt) stmt.remove();
  }

  sourceFile.formatText();
  sourceFile.saveSync();

  return {
    status: "success",
    changed: sourceFile.getFullText() !== originalSource,
  };
}
