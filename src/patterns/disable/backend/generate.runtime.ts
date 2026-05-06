import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { unmodifySvelteConfig } from "../../enable/backend/modifies/svelte-config";
import { unmodifyGitignore } from "../../enable/backend/modifies/gitignore";
import { unmodifyTestSetup } from "../../enable/backend/modifies/test-setup";

export async function generate(options: Options) {
  const logger = getLogger(options);
  const modifies: File[] = [];

  logger.info("Reverting svelte.config.js");
  const svelteConfigPath = path.join(options.root, "svelte.config.js");
  const svelteConfigFile = modifyOutcomeToFile(
    svelteConfigPath,
    unmodifySvelteConfig(svelteConfigPath),
  );
  if (svelteConfigFile) modifies.push(svelteConfigFile);

  logger.info("Reverting .gitignore");
  const gitignorePath = path.join(options.root, ".gitignore");
  const gitignoreFile = modifyOutcomeToFile(
    gitignorePath,
    unmodifyGitignore(gitignorePath),
  );
  if (gitignoreFile) modifies.push(gitignoreFile);

  logger.info("Reverting test/setup.ts");
  const testSetupPath = path.join(options.root, "test", "setup.ts");
  const testSetupFile = modifyOutcomeToFile(
    testSetupPath,
    unmodifyTestSetup(testSetupPath),
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
