import type { File, Options, Result } from "../../../core/types";
import { languageFromPath } from "../../../core/util";
import {
  parseFields,
  parseModel,
  validateModelName,
  type Collection,
} from "../../../parse";
import {
  fieldsFromCollection,
  generateSchemaSnippet,
} from "../../../core/shared";

function parsePatternArgs(argv: string[]) {
  const [modelPath, ...fields] = argv;
  if (!modelPath) {
    throw new Error("Invalid command arguments. Expected: <model> [fields...]");
  }

  return { modelPath, fields };
}

function toFile(path: string, content: string): File {
  return {
    path,
    language: languageFromPath(path),
    content,
  };
}

async function resolveInputFields(
  options: Options,
  modelPath: string,
  fieldDefs: string[],
) {
  validateModelName(modelPath);
  const model = parseModel(modelPath, options);

  if (fieldDefs.length > 0) {
    const parsed = await parseFields(fieldDefs, model, options);
    return { model, fields: parsed.fields, includeModelFields: false };
  }

  const collections =
    options.env === "runtime"
      ? ((await (
          await import("../../../parse/env.runtime")
        ).getCollections()) as Collection[])
      : (await import("../../../parse/env.preview")).getPreviewCollections(
          options,
        );
  const fields = fieldsFromCollection(model, collections, options);
  return { model, fields, includeModelFields: true };
}

export async function generate(options: Options) {
  const { modelPath, fields: fieldDefs } = parsePatternArgs(options.argv);
  const { model, fields, includeModelFields } = await resolveInputFields(
    options,
    modelPath,
    fieldDefs,
  );

  const schemaPath = `src/lib/schemas/${model.name}.ts`;
  const schema = generateSchemaSnippet(model, fields, {
    includeModelFields,
    forForm: true,
  });

  return {
    creates: [toFile(schemaPath, schema)],
    modifies: [],
    deletes: [],
    components: [],
    packages: [],
    collections: [],
  } satisfies Result;
}
