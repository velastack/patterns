import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { unmodifyHooksServer } from "./modifies/hooks.server";
import { unmodifyNavUser } from "./modifies/nav-user.svelte";
import { planDropsForCollections } from "../../destroy/shared";

export async function generate(options: Options) {
  const logger = getLogger(options);
  const modifies: File[] = [];
  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info("Reverting hooks.server.ts");
  const hooksServerPath = path.join(options.root, "src", "hooks.server.ts");
  pushResult(
    modifyOutcomeToFile(hooksServerPath, unmodifyHooksServer(hooksServerPath)),
  );

  logger.info("Reverting nav-user.svelte");
  const navUserPath = path.join(
    options.root,
    "src",
    "lib",
    "components",
    "nav-user.svelte",
  );
  pushResult(modifyOutcomeToFile(navUserPath, unmodifyNavUser(navUserPath)));

  const collectionDrops = await planDropsForCollections(["api_keys"], options);

  return {
    creates: [],
    modifies,
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops,
  } satisfies Result;
}
