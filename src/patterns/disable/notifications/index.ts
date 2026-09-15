import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";

const SLUG = "disable-notifications" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/disable/notifications";
const DOCS = "/disable/notifications";

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
  title: "Disable notifications",
  summary:
    "Drops the notifications collection, deletes the bell component, server helpers and /notifications page, and takes the bell and its loader out of the (app) layout.",
  requires: {
    auth: true,
    api: false,
    apiKeys: false,
    backend: true,
    i18n: false,
    teams: false,
    payments: false,
    blog: false,
    contentNegotiation: false,
    cms: false,
  },
  category: "auth" as const,
  tags: ["sveltekit", "notifications", "pocketbase", "velastack"],

  command: {
    raw: "vela disable notifications",
    base: "vela disable notifications",
    argv: [],
  },

  examples: [],

  tests: 0,

  baseline: "velastack-auth",

  generate,
} satisfies Pattern;
