import type { Options, Pattern, Result } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { InvalidArgumentError } from "../../../core/errors";
import { parseModel, parseRoute } from "../../../parse";
import { toDeleteEntry } from "../shared";

const SLUG = "destroy-form" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/destroy/form";
const DOCS = "/destroy/form";

export async function generate(options: Options) {
  const [modelPath] = options.argv;
  if (!modelPath) {
    throw new InvalidArgumentError(
      "Invalid command arguments. Expected: <model>",
    );
  }

  const model = parseModel(modelPath);
  const route = parseRoute(options.input.route, model, options, "form");
  const routeDir = route.fileBase;
  const schemaPath = `src/lib/schemas/${model.name}.ts`;

  const result: Result = {
    creates: [],
    modifies: [],
    deletes: [toDeleteEntry(routeDir), toDeleteEntry(schemaPath)],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
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
  title: "Destroy a form",
  summary:
    "Removes the route directory and schema file created by generate-form.",
  requires: {
    auth: false,
    api: false,
    apiKeys: false,
    backend: false,
    i18n: false,
    teams: false,
    payments: false,
    blog: false,
    contentNegotiation: false,
  },
  category: "generators" as const,
  tags: ["form", "sveltekit", "pocketbase"],

  command: {
    raw: "vela destroy form contact",
    base: "vela destroy form",
    argv: ["contact"],
  },

  examples: [
    {
      command: "login",
      description: "Remove the login form.",
    },
    {
      command: 'project --route "(app)/[team_id]/projects/new"',
      description:
        "Remove a form generated under a custom route. --route must match the create command.",
    },
  ],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
