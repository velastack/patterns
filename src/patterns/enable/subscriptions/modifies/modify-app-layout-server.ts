import { modifyByTemplate } from "./modify-by-template";
import type { ModifyOutcome } from "../../../../core/types";

const NOT_FOUND_HINT = [
  "Create src/routes/(app)/+layout.server.ts before enabling subscriptions.",
  "Enable auth first — the (app) layout is provided by the velastack-auth baseline.",
].join("\n");

export function modifyAppLayoutServer(
  filePath: string,
  template: string,
): ModifyOutcome {
  return modifyByTemplate(
    filePath,
    template,
    "loadActiveSubscription",
    NOT_FOUND_HINT,
  );
}
