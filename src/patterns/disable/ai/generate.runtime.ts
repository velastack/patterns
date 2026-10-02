import fs from "node:fs";
import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { modifyEnvRemove } from "../../../runtime/env";
import { envRevertOutcomeToFile } from "../../../runtime/modify-file";
import { toDeleteEntry } from "../../destroy/shared";
import { demoDir } from "../../enable/ai/generate";
import { allEnvEdits, allEnvNames, demoDirs } from "./generate";
import { unmodifyEnvVarsFiles } from "../../../runtime/env-vars";

export async function generate(options: Options) {
  const logger = getLogger(options);
  const modifies: File[] = [];
  const deletes: File[] = [];

  // The base result names the page in the current default group; a page
  // generated before auth was enabled sits in the other one.
  const current = demoDir(options);
  for (const dir of demoDirs(options)) {
    const page = `${dir}/+page.svelte`;
    if (dir !== current && fs.existsSync(path.join(options.root, page))) {
      deletes.push(toDeleteEntry(page));
    }
  }

  // Which provider was chosen is not recorded, so every one's key goes; the
  // file goes too when these were all it declared.
  logger.info("Removing the AI provider's API key from src/env.ts");
  const envVars = unmodifyEnvVarsFiles(options.root, allEnvNames());
  if (envVars.modify) modifies.push(envVars.modify);
  if (envVars.delete) deletes.push(envVars.delete);

  logger.info("Removing the AI provider's API key from .env");
  const envPath = path.join(options.root, ".env");
  const env = envRevertOutcomeToFile(
    envPath,
    modifyEnvRemove(envPath, allEnvEdits()),
  );
  if (env.modify) modifies.push(env.modify);
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
