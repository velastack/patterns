import type { Options, Pattern, Result } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { InvalidArgumentError } from "../../../core/errors";
import { modelPaths, parseModel } from "../../../parse";
import { planDropsForCollections, toDeleteEntry } from "../shared";

const SLUG = "destroy-scaffold" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/destroy/scaffold";
const DOCS = "/destroy/scaffold";

export async function generate(options: Options) {
  const [modelPath] = options.argv;
  if (!modelPath) {
    throw new InvalidArgumentError(
      "Invalid command arguments. Expected: <model>",
    );
  }

  const model = parseModel(modelPath, options);
  const paths = modelPaths(model);
  const schemaPath = `src/lib/schemas/${model.name}.ts`;
  const collectionDrops = await planDropsForCollections(
    [model.tableName],
    options,
  );

  const result: Result = {
    creates: [],
    modifies: [],
    deletes: [toDeleteEntry(paths.list), toDeleteEntry(schemaPath)],
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
  title: "Destroy a scaffold",
  summary:
    "Removes the route directory and schema file created by generate-scaffold and drops the collection. Retains shadcn components.",
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
  tags: ["crud", "scaffold", "pocketbase", "sveltekit"],

  command: {
    raw: "vela destroy scaffold contacts",
    base: "vela destroy scaffold",
    argv: ["contacts"],
  },

  examples: [
    {
      command: "todos",
      description: "Remove a todos scaffold.",
    },
  ],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
