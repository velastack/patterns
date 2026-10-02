import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { modifyEnvRemove } from "../../../runtime/env";
import {
  envRevertOutcomeToFile,
  modifyOutcomeToFile,
} from "../../../runtime/modify-file";
import { allEnvEdits, allEnvNames } from "./generate";
import { unmodifyEnvVarsFiles } from "../../../runtime/env-vars";
import { unmodifyLayoutSvelte } from "./modifies/layout.svelte";

export async function generate(options: Options) {
  const logger = getLogger(options);
  const modifies: File[] = [];
  const deletes: File[] = [];
  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info("Reverting src/routes/+layout.svelte");
  const layoutPath = path.join(options.root, "src", "routes", "+layout.svelte");
  pushResult(modifyOutcomeToFile(layoutPath, unmodifyLayoutSvelte(layoutPath)));

  // Which provider was chosen is not recorded, so every one's variables go;
  // the file goes too when these were all it declared.
  logger.info("Removing analytics variables from src/env.ts");
  const envVars = unmodifyEnvVarsFiles(options.root, allEnvNames());
  pushResult(envVars.modify);
  if (envVars.delete) deletes.push(envVars.delete);

  logger.info("Removing analytics variables from .env");
  const envPath = path.join(options.root, ".env");
  const env = envRevertOutcomeToFile(
    envPath,
    modifyEnvRemove(envPath, allEnvEdits()),
  );
  pushResult(env.modify);
  if (env.delete) deletes.push(env.delete);

  return {
    creates: [],
    modifies,
    deletes,
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
