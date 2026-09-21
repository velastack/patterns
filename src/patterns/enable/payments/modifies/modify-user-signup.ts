import fs from "node:fs";
import dedent from "dedent";
import { Project, QuoteKind, SyntaxKind } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import { formatLikeSource } from "../../../../runtime/ts-morph-helpers";

const WORKFLOW_MODULE = "$lib/workflows/link-stripe-customer";

const RUN_SNIPPET = dedent`
  // Queued here, done in the background: the Stripe calls retry on their own,
  // and the key means a retry never makes a second customer for this user.
  await linkStripeCustomer.run(
    { userId: user.id, email: form.data.email },
    { idempotencyKey: user.id }
  );
`;

const FAILURE_HINT = [
  "Could not locate the requestVerification call in signup +page.server.ts.",
  "Start the workflow once the user exists:",
  "",
  `import { linkStripeCustomer } from '${WORKFLOW_MODULE}';`,
  "",
  RUN_SNIPPET,
].join("\n");

const NOT_FOUND_HINT = [
  "Create src/routes/(public)/(auth)/signup/+page.server.ts before enabling payments.",
].join("\n");

/**
 * Starts the link-stripe-customer workflow right after the user is created.
 * The work itself lives in src/lib/workflows/link-stripe-customer.ts.
 */
export function modifyUserSignup(userSignupPath: string): ModifyOutcome {
  if (!fs.existsSync(userSignupPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const originalSource = fs.readFileSync(userSignupPath, "utf8");
  if (originalSource.includes("linkStripeCustomer")) {
    return { status: "success", changed: false };
  }

  const project = new Project({
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.addSourceFileAtPath(userSignupPath);

  const requestVerificationCall = sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((ce) => {
      const expr = ce.getExpression();
      return (
        expr.getKind() === SyntaxKind.PropertyAccessExpression &&
        expr.getText().includes("requestVerification")
      );
    });

  if (!requestVerificationCall) {
    return { status: "failed", message: FAILURE_HINT };
  }

  const statement = requestVerificationCall.getFirstAncestorByKind(
    SyntaxKind.ExpressionStatement,
  );

  if (!statement) {
    return { status: "failed", message: FAILURE_HINT };
  }

  sourceFile.addImportDeclaration({
    namedImports: ["linkStripeCustomer"],
    moduleSpecifier: WORKFLOW_MODULE,
  });

  statement.replaceWithText(RUN_SNIPPET + "\n\n" + statement.getText());

  formatLikeSource(sourceFile);
  sourceFile.saveSync();

  return {
    status: "success",
    changed: sourceFile.getFullText() !== originalSource,
  };
}
