import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { modifyHooksServer } from "./modifies/hooks.server";

export async function generate(options: Options) {
  const modifies: File[] = [];

  const hooksServerPath = path.join(options.root, "src", "hooks.server.ts");
  const file = modifyOutcomeToFile(
    hooksServerPath,
    modifyHooksServer(hooksServerPath),
  );
  if (file) modifies.push(file);

  return {
    creates: [],
    modifies,
    deletes: [],
    components: [],
    packages: [],
    collections: [],
  } satisfies Result;
}
