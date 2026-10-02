import type { EnvVarSpec } from "../../../runtime/env-vars-file";

/**
 * What the backend reads through `$app/env/private`, declared in `src/env.ts`
 * as the minimal template declares them: optional, so an empty `.env` builds.
 */
export const BACKEND_ENV_VARS: EnvVarSpec[] = [
  {
    name: "POCKETBASE_URL",
    description:
      "Where PocketBase listens. `vela dev` and `vela deploy` set it.",
  },
  {
    name: "POCKETBASE_SUPERUSER_EMAIL",
    description:
      "Superuser email the server signs in with for admin features and workflows.",
  },
  {
    name: "POCKETBASE_SUPERUSER_PASSWORD",
    description: "Password for POCKETBASE_SUPERUSER_EMAIL.",
  },
];
