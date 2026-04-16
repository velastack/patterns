import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { generate as generateBase } from "./generate";

const SLUG = "generate-schema" as const;
const VERSION = "1.0.7";
const SOURCE = "src/patterns/generate/schema";
const DOCS = "/generate/schema";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env !== "runtime") {
    return formatResult(baseRes);
  }

  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(await formatResult(baseRes), options);
}

export default {
  version: VERSION,
  slug: SLUG,
  source: SOURCE,
  docs: DOCS,
  plan: "open",
  title: "Generate a schema",
  summary: "Generates a zod schema.",
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
    raw: "vela generate schema contact name:text email:email",
    base: "vela generate schema",
    argv: ["contact", "name:text", "email:email"],
  },

  baseline: "velastack",

  generate,
} satisfies Pattern;
