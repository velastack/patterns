import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";

const SLUG = "disable-analytics" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/disable/analytics";
const DOCS = "/disable/analytics";

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
  title: "Disable analytics",
  summary:
    "Removes the analytics component and <Analytics /> from the root layout, strips the provider's variables from .env and uninstalls posthog-js.",
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
  category: "analytics" as const,
  tags: [
    "sveltekit",
    "analytics",
    "plausible",
    "google-analytics",
    "posthog",
    "velastack",
  ],

  command: {
    raw: "vela disable analytics",
    base: "vela disable analytics",
    argv: [],
  },

  examples: [],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
