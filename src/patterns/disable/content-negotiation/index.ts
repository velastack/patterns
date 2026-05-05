import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";

const SLUG = "disable-content-negotiation" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/disable/content-negotiation";
const DOCS = "/disable/content-negotiation";

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
  title: "Disable content negotiation",
  summary:
    "Removes sveltekit-negotiate wiring: deletes creates, unwraps hooks.server handle, reverts reroute (preserving i18n compose), removes <Negotiate /> from the root layout.",
  requires: {
    auth: false,
    api: false,
    apiKeys: false,
    i18n: false,
    teams: false,
    payments: false,
    blog: false,
    contentNegotiation: true,
  },
  category: "api" as const,
  tags: ["sveltekit", "content-negotiation", "markdown", "json", "api"],

  command: {
    raw: "vela disable content-negotiation",
    base: "vela disable content-negotiation",
    argv: [],
  },

  examples: [],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
