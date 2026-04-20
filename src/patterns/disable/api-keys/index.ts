import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";

const SLUG = "disable-api-keys" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/disable/api-keys";
const DOCS = "/disable/api-keys";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env !== "runtime") {
    return formatResult(baseRes);
  }

  const { generate: generateRuntime } = await import("./generate.runtime");
  const runtimeRes = await generateRuntime(options);
  const merged = await formatResult(mergeResults([baseRes, runtimeRes]));

  if (options.input.destructive !== true) {
    return merged;
  }

  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(merged, options);
}

export default {
  version: VERSION,
  slug: SLUG,
  source: SOURCE,
  docs: DOCS,
  plan: "open",
  title: "Disable API keys",
  summary:
    "Removes API key management: drops the api_keys collection, reverts hooks.server and nav-user, deletes generated API key routes.",
  requires: {
    auth: true,
    api: true,
    apiKeys: true,
    i18n: false,
    teams: false,
    payments: false,
  },
  category: "api" as const,
  tags: [
    "sveltekit",
    "api",
    "api-keys",
    "pocketbase",
    "velastack",
    "authentication",
  ],

  command: {
    raw: "vela disable api-keys",
    base: "vela disable api-keys",
    argv: [],
  },

  examples: [],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
