import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { modifyHooksServerWorkflows } from "./modifies/hooks.server";
import { modifyEnvVarsFiles } from "../../../runtime/env-vars";
import { WORKFLOWS_ENV_VARS } from "./env-vars";

export async function generate(options: Options) {
  const logger = getLogger(options);
  const creates: File[] = [];
  const modifies: File[] = [];

  logger.info("Modifying hooks.server.ts");
  const hooksServerPath = path.join(options.root, "src", "hooks.server.ts");
  const hooksFile = modifyOutcomeToFile(
    hooksServerPath,
    modifyHooksServerWorkflows(hooksServerPath),
  );
  if (hooksFile) modifies.push(hooksFile);

  // SvelteKit 3 exposes only declared variables; the template declares these
  // already, an older project gets whichever it is missing.
  logger.info("Declaring the workflow variables in src/env.ts");
  const envVars = modifyEnvVarsFiles(options.root, WORKFLOWS_ENV_VARS);
  if (envVars.create) creates.push(envVars.create);
  if (envVars.modify) modifies.push(envVars.modify);

  return {
    creates,
    modifies,
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
