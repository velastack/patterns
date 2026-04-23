import { modifyByTemplate } from "./modify-by-template";
import type { ModifyOutcome } from "../../../../core/types";

const NOT_FOUND_HINT = [
  "src/lib/components/nav-user.svelte is missing.",
  "Enable auth and payments first; subscriptions layers a plan label on top of the existing nav-user.",
].join("\n");

export function modifyNavUser(
  filePath: string,
  template: string,
): ModifyOutcome {
  // `planLabel` is unique to subscriptions — safe idempotency marker.
  return modifyByTemplate(filePath, template, "planLabel", NOT_FOUND_HINT);
}
