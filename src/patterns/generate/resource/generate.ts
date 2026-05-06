import type { File, Options, Result } from "../../../core/types";
import { InvalidArgumentError } from "../../../core/errors";
import { languageFromPath } from "../../../core/util";
import {
  collectionSpecFromModelFields,
  generateSchemaSnippet,
  resolveInputFields,
} from "../../../core/shared";

function parsePatternArgs(argv: string[]) {
  const [modelPath, ...fields] = argv;
  if (!modelPath) {
    throw new InvalidArgumentError(
      "Invalid command arguments. Expected: <model> [fields...]",
    );
  }

  return { modelPath, fields };
}

function toFile(path: string, content: string): File {
  return {
    path,
    language: languageFromPath(path),
    content,
    status: "success",
  };
}

export async function generate(options: Options) {
  const { modelPath, fields: fieldDefs } = parsePatternArgs(options.argv);
  const { model, fields, auth, shouldCreateCollection, collections } =
    await resolveInputFields(options, modelPath, fieldDefs);

  if (collections.some((collection) => collection.name === model.tableName)) {
    throw new InvalidArgumentError(
      `Collection "${model.tableName}" already exists. To update the schema to the latest definition, run vela generate schema ${model.tableName}`,
    );
  }

  const schemaPath = `src/lib/schemas/${model.name}.ts`;
  const schema = generateSchemaSnippet(model, fields, {
    includeModelFields: true,
    forForm: true,
  });

  return {
    creates: [toFile(schemaPath, schema)],
    modifies: [],
    deletes: [],
    components: [],
    packages: [],
    collections: shouldCreateCollection
      ? [collectionSpecFromModelFields(model, fields, auth)]
      : [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
