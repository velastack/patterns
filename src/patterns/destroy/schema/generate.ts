import type { File, Options, Result } from "../../../core/types";
import { InvalidArgumentError } from "../../../core/errors";
import { languageFromPath } from "../../../core/util";
import { parseModel } from "../../../parse/model";

export async function generate(options: Options) {
  const [modelPath] = options.argv;
  if (!modelPath) {
    throw new InvalidArgumentError(
      "Invalid command arguments. Expected: <model>",
    );
  }

  const model = parseModel(modelPath);
  const schemaPath = `src/lib/schemas/${model.name}.ts`;

  const schemaFile: File = {
    path: schemaPath,
    language: languageFromPath(schemaPath),
    content: "",
    status: "success",
  };

  return {
    creates: [],
    modifies: [],
    deletes: [schemaFile],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
