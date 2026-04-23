import fs from "node:fs";
import type { ModifyOutcome } from "../../../../core/types";

// Matches the entire cronAdd("stripe-subscriptions", ...) {...}); block with
// optional surrounding blank lines. Tolerates single- or double-quoted name
// and trailing semicolon variants.
const SUBSCRIPTION_CRON_RE =
  /\n*cronAdd\(\s*["']stripe-subscriptions["'][\s\S]*?\}\s*\)\s*;?\s*\n?/m;

export function unmodifyStripeHooks(filePath: string): ModifyOutcome {
  if (!fs.existsSync(filePath)) {
    return { status: "success", changed: false };
  }
  const original = fs.readFileSync(filePath, "utf8");
  if (!original.includes("stripe-subscriptions")) {
    return { status: "success", changed: false };
  }
  const next = original.replace(SUBSCRIPTION_CRON_RE, "\n");
  if (next === original) {
    return { status: "success", changed: false };
  }
  fs.writeFileSync(filePath, next, "utf8");
  return { status: "success", changed: true };
}
