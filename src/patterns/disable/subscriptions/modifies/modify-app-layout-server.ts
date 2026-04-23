import dedent from "dedent";
import { revertByTemplate } from "./revert-by-template";
import type { ModifyOutcome } from "../../../../core/types";

// Baseline velastack-auth (app)/+layout.server.ts — the state of the file
// before enable-subscriptions wrapped it with loadActiveSubscription.
const BASELINE = dedent`
  export const load = ({ locals }) => {
  \tconst user = locals.pb.authStore.record!;
  \tconst breadcrumbs = [{ title: 'Home', url: '/dashboard' }];

  \treturn { user, breadcrumbs };
  };
` + "\n";

export function unmodifyAppLayoutServer(filePath: string): ModifyOutcome {
  return revertByTemplate(filePath, BASELINE, "loadActiveSubscription");
}
