import fs from "node:fs";
import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { toDeleteEntry } from "../../destroy/shared";
import { getLogger } from "../../../core/logger";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { unmodifyHooksServerNegotiate } from "./modifies/hooks.server";
import { unmodifyHooksNegotiate } from "./modifies/hooks";
import { unmodifyRootLayoutNegotiate } from "./modifies/root-layout.svelte";

export async function generate(options: Options) {
  const logger = getLogger(options);
  const modifies: File[] = [];
  const deletes: File[] = [];
  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info("Reverting hooks.server.ts");
  const hooksServerPath = path.join(options.root, "src", "hooks.server.ts");
  pushResult(
    modifyOutcomeToFile(
      hooksServerPath,
      unmodifyHooksServerNegotiate(hooksServerPath),
    ),
  );

  logger.info("Reverting hooks.ts");
  const hooksPath = path.join(options.root, "src", "hooks.ts");
  const hooksOutcome = unmodifyHooksNegotiate(hooksPath);
  if (
    fs.existsSync(hooksPath) &&
    fs.readFileSync(hooksPath, "utf8").trim() === ""
  ) {
    // The reroute was all it contained; the file goes with it.
    deletes.push(toDeleteEntry(hooksPath));
  } else {
    pushResult(modifyOutcomeToFile(hooksPath, hooksOutcome));
  }

  logger.info("Reverting src/routes/+layout.svelte");
  const rootLayoutPath = path.join(
    options.root,
    "src",
    "routes",
    "+layout.svelte",
  );
  pushResult(
    modifyOutcomeToFile(
      rootLayoutPath,
      unmodifyRootLayoutNegotiate(rootLayoutPath),
    ),
  );

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
