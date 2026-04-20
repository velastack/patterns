import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { generate as generateBase } from "./generate";

const SLUG = "destroy-schema" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/destroy/schema";
const DOCS = "/destroy/schema";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);
  const formatted = await formatResult(baseRes);

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
  title: "Destroy a schema",
  summary: "Removes the zod schema file created by generate-schema.",
  requires: {
    auth: false,
    api: false,
    apiKeys: false,
    i18n: false,
    teams: false,
    payments: false,
  },
  category: "generators" as const,
  tags: ["zod", "schema", "pocketbase"],

  command: {
    raw: "vela destroy schema contact",
    base: "vela destroy schema",
    argv: ["contact"],
  },

  examples: [
    {
      command: "login",
      description: "Remove the login validation schema.",
    },
  ],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
