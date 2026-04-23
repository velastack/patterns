import { revertByTemplate } from "./revert-by-template";
import type { ModifyOutcome } from "../../../../core/types";

export function unmodifyBillingPageSvelte(
  filePath: string,
  paymentsBillingPageSvelteTemplate: string,
): ModifyOutcome {
  return revertByTemplate(
    filePath,
    paymentsBillingPageSvelteTemplate,
    "availablePlans",
  );
}
