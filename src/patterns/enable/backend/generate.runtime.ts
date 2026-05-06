import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { modifySvelteConfig } from "./modifies/svelte-config";
import { modifyGitignore } from "./modifies/gitignore";
import { modifyTestSetup } from "./modifies/test-setup";

export async function generate(options: Options) {
  const logger = getLogger(options);
  const modifies: File[] = [];

  logger.info("Modifying svelte.config.js");
  const svelteConfigPath = path.join(options.root, "svelte.config.js");
  const svelteConfigFile = modifyOutcomeToFile(
    svelteConfigPath,
    modifySvelteConfig(svelteConfigPath),
  );
  if (svelteConfigFile) modifies.push(svelteConfigFile);

  logger.info("Modifying .gitignore");
  const gitignorePath = path.join(options.root, ".gitignore");
  const gitignoreFile = modifyOutcomeToFile(
    gitignorePath,
    modifyGitignore(gitignorePath),
  );
  if (gitignoreFile) modifies.push(gitignoreFile);

  logger.info("Modifying test/setup.ts");
  const testSetupPath = path.join(options.root, "test", "setup.ts");
  const testSetupFile = modifyOutcomeToFile(
    testSetupPath,
    modifyTestSetup(testSetupPath),
  );
  if (testSetupFile) modifies.push(testSetupFile);

  return {
    creates: [],
    modifies,
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
