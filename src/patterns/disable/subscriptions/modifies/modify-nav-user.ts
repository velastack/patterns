import { revertByTemplate } from "./revert-by-template";
import type { ModifyOutcome } from "../../../../core/types";

export function unmodifyNavUser(
  filePath: string,
  paymentsNavUserTemplate: string,
): ModifyOutcome {
  return revertByTemplate(filePath, paymentsNavUserTemplate, "planLabel");
}
