import type { File, Options, Result } from "../../../core/types";
import { languageFromPath } from "../../../core/util";
import {
  parseFields,
  parseModel,
  validateModelName,
  type Collection,
} from "../../../parse";
import {
  collectionSpecFromModelFields,
  fieldsFromCollection,
  generateSchemaSnippet,
} from "../shared";

const MODEL_INDEX = 2;
const FIELD_START_INDEX = 3;

function parseCommandArgs(argv: string[]) {
  if (argv.length <= MODEL_INDEX) {
    throw new Error(
      "Invalid command arguments. Expected: generate resource <model> [fields...]",
    );
  }

  const [command, subcommand] = argv;
  if (command !== "generate" || subcommand !== "resource") {
    throw new Error(
      `Invalid command "${argv.join(" ")}". Expected to start with "generate resource".`,
    );
  }

  const modelPath = argv[MODEL_INDEX];
  const fields = argv.slice(FIELD_START_INDEX);
  return { modelPath, fields };
}

function toFile(path: string, content: string): File {
  return {
    path,
    language: languageFromPath(path),
    content,
  };
}

async function resolveInputFields(options: Options, modelPath: string, fieldDefs: string[]) {
  validateModelName(modelPath);
  const model = parseModel(modelPath, options);

  if (fieldDefs.length > 0) {
    const parsed = await parseFields(fieldDefs, model, options);
    return { model, fields: parsed.fields, auth: parsed.auth, shouldCreateCollection: true };
  }

  const collections =
    options.env === "runtime"
      ? ((await (await import("../../../parse/env.runtime")).getCollections()) as Collection[])
      : (await import("../../../parse/env.preview")).getPreviewCollections(options);
  const fields = fieldsFromCollection(model, collections, options);
  return { model, fields, auth: undefined, shouldCreateCollection: false };
}

export async function generate(options: Options) {
  const { modelPath, fields: fieldDefs } = parseCommandArgs(options.argv);
  const { model, fields, auth, shouldCreateCollection } = await resolveInputFields(
    options,
    modelPath,
    fieldDefs,
  );

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
  } satisfies Result;
}
