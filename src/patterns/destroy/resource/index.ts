import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { generate as generateForward } from "../../generate/resource/generate";
import { inverseCreates, planDropsForCollections } from "../shared";

const SLUG = "destroy-resource" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/destroy/resource";
const DOCS = "/destroy/resource";

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
  title: "Destroy a resource",
  summary:
    "Removes the resource files created by generate-resource and drops the associated collection.",
  requires: {
    auth: false,
    api: false,
    apiKeys: false,
    i18n: false,
    teams: false,
    payments: false,
  },
  category: "generators" as const,
  tags: ["pocketbase", "resource", "schema"],

  command: {
    raw: "vela destroy resource contact name:text email:email",
    base: "vela destroy resource",
    argv: ["contact", "name:text", "email:email"],
  },

  examples: [
    {
      command: "articles title:text! body:editor",
      description: "Remove an articles resource.",
    },
  ],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
