import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";

const SLUG = "disable-i18n" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/disable/i18n";
const DOCS = "/disable/i18n";

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
  title: "Disable i18n",
  summary:
    "Removes i18n scaffolding files and the Wuchale .gitignore block. vite.config, svelte.config, hooks.server, app.html, and +layout.ts must be reverted manually.",
  requires: {
    auth: false,
    api: false,
    apiKeys: false,
    i18n: true,
    teams: false,
    payments: false,
    blog: false,
    contentNegotiation: false,
  },
  category: "i18n" as const,
  tags: ["sveltekit", "i18n", "localization", "wuchale", "velastack"],

  command: {
    raw: "vela disable i18n",
    base: "vela disable i18n",
    argv: [],
  },

  examples: [],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
