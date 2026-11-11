import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";

const SLUG = "disable-og" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/disable/og";
const DOCS = "/disable/og";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env !== "runtime") {
    return formatResult(baseRes, options);
  }

  const { generate: generateRuntime } = await import("./generate.runtime");
  const runtimeRes = await generateRuntime(options);
  const merged = await formatResult(
    mergeResults([baseRes, runtimeRes]),
    options,
  );

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
  title: "Disable Open Graph images",
  summary:
    "Removes the share card, its route and renderer, takes withCard off the root layout and uninstalls @takumi-rs/core.",
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
    cms: false,
  },
  category: "content" as const,
  tags: ["sveltekit", "open-graph", "og-image", "seo", "velastack"],

  command: {
    raw: "vela disable og",
    base: "vela disable og",
    argv: [],
  },

  examples: [],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
