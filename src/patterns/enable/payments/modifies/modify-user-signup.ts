import fs from "node:fs";
import dedent from "dedent";
import { Project, QuoteKind, SyntaxKind } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";

const LINK_STRIPE_CUSTOMER_SNIPPET = dedent`
  const linkStripeCustomer = async (email: string, user: { id: string }, locals: App.Locals) => {
    const matchingCustomer = await stripe.customers.list({
      email: email,
      limit: 1,
      expand: ['data.invoice_settings']
    });

    let customer;
    let isExistingCustomer = false;

    if (matchingCustomer.data.length > 0) {
      isExistingCustomer = true;
      customer = matchingCustomer.data[0];
    } else {
      customer = await stripe.customers.create({
        email: email
      });
    }

    await locals.admin.collection('stripe_customers').create({
      id: customer.id,
      user: user.id
    });

    if (!isExistingCustomer) {
      return;
    }

    const paymentMethods = await stripe.customers.listPaymentMethods(customer.id, {
      type: 'card',
      allow_redisplay: 'always'
    });

    for (const paymentMethod of paymentMethods.data) {
      if (paymentMethod.allow_redisplay === 'unspecified') {
        continue;
      }

      await locals.admin.collection('stripe_payment_methods').create({
        id: paymentMethod.id,
        customer: customer.id,
        brand: paymentMethod.card?.brand,
        last4: paymentMethod.card?.last4,
        exp_month: paymentMethod.card?.exp_month,
        exp_year: paymentMethod.card?.exp_year
      });
    }

    const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;

    if (defaultPaymentMethod) {
      try {
        await locals.admin.collection('stripe_customers').update(customer.id, {
          default_payment_method: defaultPaymentMethod
        });
      } catch {}
    }
  };
`;

const FAILURE_HINT = [
  "Could not locate the requestVerification call in signup +page.server.ts.",
  "Add a linkStripeCustomer helper and call it before requestVerification().",
].join("\n");

const NOT_FOUND_HINT = [
  "Create src/routes/(public)/(auth)/signup/+page.server.ts before enabling payments.",
].join("\n");

export function modifyUserSignup(userSignupPath: string): ModifyOutcome {
  if (!fs.existsSync(userSignupPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const originalSource = fs.readFileSync(userSignupPath, "utf8");

  const project = new Project({
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.addSourceFileAtPath(userSignupPath);

  const hasStripeImport = sourceFile
    .getImportDeclarations()
    .some((d) => d.getModuleSpecifierValue() === "$lib/stripe");

  if (hasStripeImport) {
    return { status: "success", changed: false };
  }

  sourceFile.addImportDeclaration({
    defaultImport: "stripe",
    moduleSpecifier: "$lib/stripe",
  });

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

  sourceFile.addStatements(LINK_STRIPE_CUSTOMER_SNIPPET);

  const stripeCall = dedent`
    await linkStripeCustomer(form.data.email, user, locals);
  `;

  statement.replaceWithText(stripeCall + "\n\n" + statement.getText());

  sourceFile.formatText();
  sourceFile.saveSync();

  return {
    status: "success",
    changed: sourceFile.getFullText() !== originalSource,
  };
}
