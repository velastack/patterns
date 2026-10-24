import fs from "node:fs";
import dedent from "dedent";
import { Node, SyntaxKind } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import {
  ensureImports,
  formatLikeSource,
  removeImportByModuleSpecifier,
  withInMemoryScript,
} from "../../../../runtime/ts-morph-helpers";

const COMPLETED = "./checkout/completed";
const ASYNC_PAYMENT = "./checkout/async-payment";

/** The Checkout Session events the order handlers take. */
const EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
];

const CASES_SNIPPET = dedent`
  case 'checkout.session.completed':
    await handleCheckoutSessionCompleted(event.data.object, locals);
    break;

  case 'checkout.session.async_payment_succeeded':
  case 'checkout.session.async_payment_failed':
    await handleCheckoutAsyncPayment(event.data.object, locals);
    break;
`;

const FAILURE_HINT = dedent`
  Route the Checkout Session events to the order handlers in src/routes/webhooks/stripe/handlers/dispatch.ts:

  import { handleCheckoutSessionCompleted } from '${COMPLETED}';
  import { handleCheckoutAsyncPayment } from '${ASYNC_PAYMENT}';

  and, inside the \`switch (event.type)\`:

  ${CASES_SNIPPET.split("\n").join("\n  ")}
`;

const NOT_FOUND_HINT =
  "Enable payments first: src/routes/webhooks/stripe/handlers/dispatch.ts is created by enable-payments.";

/** The `switch (event.type)` the dispatcher routes on. */
function eventSwitch(sf: import("ts-morph").SourceFile) {
  return sf
    .getDescendantsOfKind(SyntaxKind.SwitchStatement)
    .find((statement) =>
      statement.getExpression().getText().includes("event.type"),
    );
}

/** The order handlers join the dispatcher's switch, ahead of its default. */
export function modifyWebhookServer(filePath: string): ModifyOutcome {
  if (!fs.existsSync(filePath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }
  const original = fs.readFileSync(filePath, "utf8");
  if (original.includes("handleCheckoutSessionCompleted")) {
    return { status: "success", changed: false };
  }

  let added = false;
  const { source } = withInMemoryScript(original, (sf) => {
    const statement = eventSwitch(sf);
    if (!statement) return;
    const clauses = statement.getCaseBlock().getClauses();
    const defaultClause = clauses.find(Node.isDefaultClause);
    if (defaultClause) {
      defaultClause.replaceWithText(
        `${CASES_SNIPPET}\n\n${defaultClause.getText()}`,
      );
    } else if (clauses.length > 0) {
      const last = clauses[clauses.length - 1];
      last.replaceWithText(`${last.getText()}\n\n${CASES_SNIPPET}`);
    } else {
      return;
    }
    ensureImports(sf, [
      {
        namedImports: ["handleCheckoutSessionCompleted"],
        moduleSpecifier: COMPLETED,
      },
      {
        namedImports: ["handleCheckoutAsyncPayment"],
        moduleSpecifier: ASYNC_PAYMENT,
      },
    ]);
    formatLikeSource(sf);
    added = true;
  });
  if (!added) return { status: "failed", message: FAILURE_HINT };
  fs.writeFileSync(filePath, source, "utf8");
  return { status: "success", changed: true };
}

/** Take the order cases and their imports back out of the dispatcher. */
export function unmodifyWebhookServer(filePath: string): ModifyOutcome {
  if (!fs.existsSync(filePath)) {
    return { status: "success", changed: false };
  }
  const original = fs.readFileSync(filePath, "utf8");
  if (!original.includes("handleCheckoutSessionCompleted")) {
    return { status: "success", changed: false };
  }

  const { source } = withInMemoryScript(original, (sf) => {
    const statement = eventSwitch(sf);
    if (statement) {
      // Each run of order clauses goes with the whitespace before it, so the
      // blank line that separated its neighbours is the one that stays.
      const clauses = statement.getCaseBlock().getClauses();
      const isOrders = (clause: (typeof clauses)[number]) => {
        if (!Node.isCaseClause(clause)) return false;
        const expression = clause.getExpression();
        return (
          Node.isStringLiteral(expression) &&
          EVENTS.includes(expression.getLiteralText())
        );
      };
      // Positions first, bottom-up: removing text forgets the nodes after it.
      const ranges: [number, number][] = [];
      for (let i = clauses.length - 1; i >= 0; i--) {
        if (!isOrders(clauses[i])) continue;
        let first = i;
        while (first > 0 && isOrders(clauses[first - 1])) first--;
        const start =
          first > 0 ? clauses[first - 1].getEnd() : clauses[first].getStart();
        ranges.push([start, clauses[i].getEnd()]);
        i = first;
      }
      for (const [start, end] of ranges) sf.removeText(start, end);
    }
    removeImportByModuleSpecifier(sf, COMPLETED);
    removeImportByModuleSpecifier(sf, ASYNC_PAYMENT);
    formatLikeSource(sf);
  });
  fs.writeFileSync(filePath, source, "utf8");
  return { status: "success", changed: source !== original };
}
