import fs from "node:fs";
import dedent from "dedent";
import type { ModifyOutcome } from "../../../../core/types";

const CRON_SNIPPET = dedent`
  cronAdd("stripe-subscriptions", "*/2 * * * *", () => {
    const utils = require(\`\${__hooks}/utils.js\`);
    utils.triggerJob("/api/stripe/sync/subscriptions");
  });
`;

const FAILURE_HINT = [
  "Append the stripe-subscriptions cron to data/hooks/stripe.pb.js:",
  "",
  CRON_SNIPPET,
].join("\n");

const NOT_FOUND_HINT = [
  "Enable payments first — data/hooks/stripe.pb.js is created by enable-payments.",
  "",
  "Once present, append:",
  "",
  CRON_SNIPPET,
].join("\n");

export function modifyStripeHooks(filePath: string): ModifyOutcome {
  if (!fs.existsSync(filePath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }
  const current = fs.readFileSync(filePath, "utf8");
  if (current.includes("stripe-subscriptions")) {
    return { status: "success", changed: false };
  }
  if (!current.includes("cronAdd(")) {
    return { status: "failed", message: FAILURE_HINT };
  }
  const trailing = current.endsWith("\n") ? "" : "\n";
  const next = `${current}${trailing}\n${CRON_SNIPPET}\n`;
  fs.writeFileSync(filePath, next, "utf8");
  return { status: "success", changed: true };
}
