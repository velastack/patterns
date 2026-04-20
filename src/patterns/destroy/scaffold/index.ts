import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { generate as generateForward } from "../../generate/scaffold/generate";
import { inverseCreates, planDropsForCollections } from "../shared";

const SLUG = "destroy-scaffold" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/destroy/scaffold";
const DOCS = "/destroy/scaffold";

export async function generate(options: Options) {
  const forwardRes = await generateForward(options);
  const inverseRes = inverseCreates(forwardRes);
  const collectionDrops = await planDropsForCollections(
    forwardRes.collections.map((c) => c.name),
    options,
  );
  inverseRes.collectionDrops = collectionDrops;

  const formatted = await formatResult(inverseRes);

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
    "Removes the CRUD routes created by generate-scaffold and drops the associated collection. Retains shadcn components.",
  requires: {
    auth: false,
    api: false,
    apiKeys: false,
    i18n: false,
    teams: false,
    payments: false,
  },
  category: "generators" as const,
  tags: ["crud", "scaffold", "pocketbase", "sveltekit"],

  command: {
    raw: "vela destroy scaffold contact name:text email:email",
    base: "vela destroy scaffold",
    argv: ["contact", "name:text", "email:email"],
  },

  examples: [
    {
      command: "todos title:text! done:bool",
      description: "Remove a todos scaffold.",
    },
  ],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
