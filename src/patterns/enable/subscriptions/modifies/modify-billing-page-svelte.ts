import { modifyByTemplate } from "./modify-by-template";
import type { ModifyOutcome } from "../../../../core/types";

const NOT_FOUND_HINT = [
  "src/routes/(app)/billing/+page.svelte is missing.",
  "Enable payments first — subscriptions extends the billing page with plan management.",
].join("\n");

export function modifyBillingPageSvelte(
  filePath: string,
  template: string,
): ModifyOutcome {
  return modifyByTemplate(filePath, template, "availablePlans", NOT_FOUND_HINT);
}
