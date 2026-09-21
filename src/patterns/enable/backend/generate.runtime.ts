import fs from "node:fs";
import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { modifySvelteConfig } from "./modifies/svelte-config";
import { modifyGitignore } from "./modifies/gitignore";
import { languageFromPath } from "../../../core/util";
import {
  hasVitestConfig,
  modifyTestSetup,
  VITEST_CONFIG,
  WITH_BACKEND,
} from "./modifies/test-setup";
import { modifyHooksServerBackend } from "./modifies/hooks.server";

export async function generate(options: Options) {
  const logger = getLogger(options);
  const modifies: File[] = [];
  const creates: File[] = [];
  const create = (filePath: string, content: string) =>
    creates.push({
      path: filePath,
      language: languageFromPath(filePath),
      content,
      status: "success",
    });

  logger.info("Modifying adapter config");
  const adapter = modifySvelteConfig(options.root);
  const svelteConfigFile = modifyOutcomeToFile(
    adapter.filePath,
    adapter.outcome,
  );
  if (svelteConfigFile) modifies.push(svelteConfigFile);

  // A hooks.server.ts the project already has keeps its handles; the create
  // only writes the file where there is none (see `keepMissing` in index.ts).
  const hooksServerPath = path.join(options.root, "src", "hooks.server.ts");
  const hooksServerFile = modifyOutcomeToFile(
    hooksServerPath,
    modifyHooksServerBackend(hooksServerPath),
  );
  if (hooksServerFile) {
    logger.info("Modifying hooks.server.ts");
    modifies.push(hooksServerFile);
  }

  logger.info("Modifying .gitignore");
  const gitignorePath = path.join(options.root, ".gitignore");
  const gitignoreFile = modifyOutcomeToFile(
    gitignorePath,
    modifyGitignore(gitignorePath),
  );
  if (gitignoreFile) modifies.push(gitignoreFile);

  // A backend brings server tests with it. The static template and a project
  // vela did not create have no harness at all, so what is missing is created:
  // the setup file, and the vitest config that loads it.
  const testSetupPath = path.join(options.root, "test", "setup.ts");
  if (fs.existsSync(testSetupPath)) {
    logger.info("Modifying test/setup.ts");
    const testSetupFile = modifyOutcomeToFile(
      testSetupPath,
      modifyTestSetup(testSetupPath),
    );
    if (testSetupFile) modifies.push(testSetupFile);
  } else {
    logger.info("Creating test/setup.ts");
    create("test/setup.ts", WITH_BACKEND);
  }

  if (!hasVitestConfig(options.root)) {
    logger.info("Creating vitest.config.ts");
    create("vitest.config.ts", VITEST_CONFIG);
  }

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
