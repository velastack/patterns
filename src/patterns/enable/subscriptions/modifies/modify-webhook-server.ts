import fs from "node:fs";
import { SyntaxKind } from "ts-morph";
import dedent from "dedent";
import type { ModifyOutcome } from "../../../../core/types";
import {
  ensureImports,
  withInMemoryScript,
  formatLikeSource,
} from "../../../../runtime/ts-morph-helpers";

const FAILURE_HINT = dedent`
  Wire the subscription event handlers into src/routes/webhooks/stripe/handlers/dispatch.ts:

  Add imports:
    import { handleSubscriptionCreated } from "./subscription/created";
    import { handleSubscriptionUpdated } from "./subscription/updated";
    import { handleSubscriptionDeleted } from "./subscription/deleted";

  Add switch cases inside the event.type switch:
    case "customer.subscription.created":
      await handleSubscriptionCreated(event.data.object, locals);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object, locals);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, locals);
      break;
`;

const NOT_FOUND_HINT =
  "Enable payments first — src/routes/webhooks/stripe/handlers/dispatch.ts is created by enable-payments.";

const SUBSCRIPTION_CASES_SNIPPET = dedent`
  case "customer.subscription.created":
    await handleSubscriptionCreated(event.data.object, locals);
    break;

  case "customer.subscription.updated":
    await handleSubscriptionUpdated(event.data.object, locals);
    break;

  case "customer.subscription.deleted":
    await handleSubscriptionDeleted(event.data.object, locals);
    break;
`;

export function modifyWebhookServer(filePath: string): ModifyOutcome {
  if (!fs.existsSync(filePath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const original = fs.readFileSync(filePath, "utf8");
  if (original.includes("handleSubscriptionCreated")) {
    return { status: "success", changed: false };
  }

  let addedCases = false;
  const { source } = withInMemoryScript(original, (sf) => {
    ensureImports(sf, [
      {
        namedImports: ["handleSubscriptionCreated"],
        moduleSpecifier: "./subscription/created",
      },
      {
        namedImports: ["handleSubscriptionUpdated"],
        moduleSpecifier: "./subscription/updated",
      },
      {
        namedImports: ["handleSubscriptionDeleted"],
        moduleSpecifier: "./subscription/deleted",
      },
    ]);

    const switchStmt = sf
      .getDescendantsOfKind(SyntaxKind.SwitchStatement)
      .find((stmt) => stmt.getExpression().getText().includes("event.type"));
    if (!switchStmt) return;

    const caseBlock = switchStmt.getCaseBlock();
    const clauses = caseBlock.getClauses();
    const defaultClause = clauses.find(
      (c) => c.getKind() === SyntaxKind.DefaultClause,
    );

    // Prepend subscription cases in front of the default clause, or append
    // before the closing brace of the case block if there's no default.
    const prefix = `${SUBSCRIPTION_CASES_SNIPPET}\n\n`;
    if (defaultClause) {
      defaultClause.replaceWithText(prefix + defaultClause.getText());
    } else if (clauses.length > 0) {
      const last = clauses[clauses.length - 1];
      last.replaceWithText(
        last.getText() + `\n\n${SUBSCRIPTION_CASES_SNIPPET}`,
      );
    } else {
      return;
    }

    formatLikeSource(sf);
    addedCases = true;
  });

  if (!addedCases) {
    return { status: "failed", message: FAILURE_HINT };
  }

  fs.writeFileSync(filePath, source, "utf8");
  return { status: "success", changed: true };
}
