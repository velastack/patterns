import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { unmodifyGitignore } from "./modifies/gitignore";

const MANUAL_REMEDIATION = [
  "vite.config, svelte.config, hooks.server, app.html, and +layout.ts must be reverted manually.",
  "The i18n integration touches these files in ways that are not safely reversible by tooling.",
  "See the enable-i18n modifies for the blocks to remove.",
].join(" ");

export async function generate(options: Options) {
  const logger = getLogger(options);
  const modifies: File[] = [];
  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info("Reverting .gitignore");
  const gitignorePath = path.join(options.root, ".gitignore");
  pushResult(
    modifyOutcomeToFile(gitignorePath, unmodifyGitignore(gitignorePath)),
  );

  logger.info(MANUAL_REMEDIATION);

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
