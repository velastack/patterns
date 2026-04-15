import fs from "node:fs";
import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { modifyHooksServer } from "./modifies/hooks.server";

export async function generate(options: Options) {
  const modifies: File[] = [];

  const hooksServerPath = path.join(options.root, "src", "hooks.server.ts");
  if (fs.existsSync(hooksServerPath)) {
    modifyHooksServer(hooksServerPath);
    modifies.push({
      path: hooksServerPath,
      language: "ts",
      content: fs.readFileSync(hooksServerPath, "utf8"),
    });
  }

  return {
    creates: [],
    modifies,
    deletes: [],
    components: [],
    packages: [],
    collections: [],
  } satisfies Result;
}
