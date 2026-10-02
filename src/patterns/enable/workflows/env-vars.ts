import type { EnvVarSpec } from "../../../runtime/env-vars-file";
import { BACKEND_ENV_VARS } from "../backend/env-vars";

/**
 * What `src/lib/server/workflows.ts` reads through `$app/env/private`, in the
 * minimal template's order and words: the PocketBase connection, then the
 * worker's own switches.
 */
export const WORKFLOWS_ENV_VARS: EnvVarSpec[] = [
  ...BACKEND_ENV_VARS,
  {
    name: "WORKFLOWS_ENABLED",
    description:
      "Set to `false` to stop this process running workflows; it can still start them.",
  },
  {
    name: "WORKFLOWS_CONCURRENCY",
    description:
      "How many workflow runs this process executes at once. Defaults to 5.",
  },
  {
    name: "TEST",
    description:
      "`true` under `vela test:server`, which turns off the workflow cron schedules.",
  },
];
