import { revertByTemplate } from "./revert-by-template";
import type { ModifyOutcome } from "../../../../core/types";

export function unmodifyBillingPageServer(
  filePath: string,
  paymentsBillingPageServerTemplate: string,
): ModifyOutcome {
  return revertByTemplate(
    filePath,
    paymentsBillingPageServerTemplate,
    "selectPlan",
  );
}
