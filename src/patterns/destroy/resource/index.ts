import type { Options, Pattern, Result } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { InvalidArgumentError } from "../../../core/errors";
import { parseModel } from "../../../parse/model";
import { planDropsForCollections, toDeleteEntry } from "../shared";

const SLUG = "destroy-resource" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/destroy/resource";
const DOCS = "/destroy/resource";

export async function generate(options: Options) {
  const [modelPath] = options.argv;
  if (!modelPath) {
    throw new InvalidArgumentError(
      "Invalid command arguments. Expected: <model>",
    );
  }

  const model = parseModel(modelPath, options);
  const schemaPath = `src/lib/schemas/${model.name}.ts`;
  const collectionDrops = await planDropsForCollections(
    [model.tableName],
    options,
  );

  const result: Result = {
    creates: [],
    modifies: [],
    deletes: [toDeleteEntry(schemaPath)],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops,
  };
  const formatted = await formatResult(result);

  if (options.env !== "runtime" || options.input.destructive !== true) {
    return formatted;
  }

  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(formatted, options);
}

export default {
  version: VERSION,
  slug: SLUG,
  source: SOURCE,
  docs: DOCS,
  plan: "open",
  title: "Destroy a resource",
  summary:
    "Drops the collection and removes the schema file created by generate-resource.",
  requires: {
    auth: false,
    api: false,
    apiKeys: false,
    backend: true,
    i18n: false,
    teams: false,
    payments: false,
    blog: false,
    contentNegotiation: false,
  },
  category: "generators" as const,
  tags: ["pocketbase", "resource", "schema"],

  command: {
    raw: "vela destroy resource contacts",
    base: "vela destroy resource",
    argv: ["contacts"],
  },

  examples: [
    {
      command: "articles",
      description: "Remove an articles resource.",
    },
  ],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
