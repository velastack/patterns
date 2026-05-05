import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { modifyUtils } from "../../../runtime/modify-utils";
import { modifyHooksServer } from "./modifies/hooks.server";
import { modifyNavUser } from "./modifies/nav-user.svelte";

export async function generate(options: Options) {
  const logger = getLogger(options);

  const modifies: File[] = [];
  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info("Modifying hooks.server.ts");
  const hooksServerPath = path.join(options.root, "src", "hooks.server.ts");
  pushResult(
    modifyOutcomeToFile(hooksServerPath, modifyHooksServer(hooksServerPath)),
  );

  logger.info("Modifying nav-user");
  const navUserPath = path.join(
    options.root,
    "src",
    "lib",
    "components",
    "nav-user.svelte",
  );
  pushResult(modifyOutcomeToFile(navUserPath, modifyNavUser(navUserPath)));

  logger.info("Modifying utils.ts");
  const utilsPath = path.join(options.root, "src", "lib", "utils.ts");
  pushResult(modifyOutcomeToFile(utilsPath, modifyUtils(utilsPath)));

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
