import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { generate as generateBase } from "./generate";

const SLUG = "generate-resource" as const;
const VERSION = "1.0.7";
const SOURCE = "src/patterns/generate/resource";
const DOCS = "/generate/resource";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env !== "runtime") {
    return formatResult(baseRes);
  }

  const { createCollections } = await import("../../../runtime/collections");
  const migrationCreates = await createCollections(
    baseRes.collections,
    options,
  );
  const runtimeRes = {
    ...baseRes,
    creates: [...baseRes.creates, ...migrationCreates],
  };

  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(await formatResult(runtimeRes), options);
}

export default {
  version: VERSION,
  slug: SLUG,
  source: SOURCE,
  docs: DOCS,
  plan: "open",
  title: "Generate a resource",
  summary: "Generates model schema resources.",
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
    raw: "vela generate resource contact name:text email:email",
    base: "vela generate resource",
    argv: ["contact", "name:text", "email:email"],
  },

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
