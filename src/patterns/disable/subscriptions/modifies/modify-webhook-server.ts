import fs from "node:fs";
import { SyntaxKind } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import {
  removeImportByModuleSpecifier,
  withInMemoryScript,
} from "../../../../runtime/ts-morph-helpers";

const SUBSCRIPTION_CASE_VALUES = new Set([
  '"customer.subscription.created"',
  '"customer.subscription.updated"',
  '"customer.subscription.deleted"',
]);

export function unmodifyWebhookServer(filePath: string): ModifyOutcome {
  if (!fs.existsSync(filePath)) {
    return { status: "success", changed: false };
  }
  const original = fs.readFileSync(filePath, "utf8");
  if (!original.includes("handleSubscriptionCreated")) {
    return { status: "success", changed: false };
  }

  const { source } = withInMemoryScript(original, (sf) => {
    removeImportByModuleSpecifier(sf, "./handlers/subscription/created");
    removeImportByModuleSpecifier(sf, "./handlers/subscription/updated");
    removeImportByModuleSpecifier(sf, "./handlers/subscription/deleted");

    const switchStmt = sf
      .getDescendantsOfKind(SyntaxKind.SwitchStatement)
      .find((stmt) => stmt.getExpression().getText().includes("event.type"));
    if (!switchStmt) return;

    const caseBlock = switchStmt.getCaseBlock();
    // Collect matching case clauses first — removing invalidates node refs.
    const toRemove = caseBlock
      .getClauses()
      .filter((clause) => {
        if (clause.getKind() !== SyntaxKind.CaseClause) return false;
        const caseClause = clause.asKindOrThrow(SyntaxKind.CaseClause);
        const exprText = caseClause.getExpression().getText();
        return SUBSCRIPTION_CASE_VALUES.has(exprText);
      })
      .map((c) => c.asKindOrThrow(SyntaxKind.CaseClause));

    for (const clause of toRemove.reverse()) {
      clause.remove();
    }

    sf.formatText();
  });

  if (source === original) {
    return { status: "success", changed: false };
  }
  fs.writeFileSync(filePath, source, "utf8");
  return { status: "success", changed: true };
}
