import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";
import { generate as generatePreview } from "./generate.preview";

const SLUG = "enable-notifications" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/enable/notifications";
const DOCS = "/enable/notifications";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env === "preview") {
    const previewRes = await generatePreview(options);
    return formatResult(mergeResults([baseRes, previewRes]));
  }

  const { generate: generateRuntime } = await import("./generate.runtime");
  const runtimeRes = await generateRuntime(options);
  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(
    await formatResult(mergeResults([baseRes, runtimeRes])),
    options,
  );
}

export default {
  version: VERSION,
  slug: SLUG,
  source: SOURCE,
  docs: DOCS,
  plan: "open",
  title: "Enable notifications",
  summary:
    "Adds an in-app notifications collection, a bell dropdown with 30s polling, and a /notifications page for managing read state.",
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
  },
  category: "auth" as const,
  tags: [
    "sveltekit",
    "notifications",
    "pocketbase",
    "velastack",
    "in-app",
    "polling",
  ],

  command: {
    raw: "vela enable notifications",
    base: "vela enable notifications",
    argv: [],
  },

  examples: [],

  tests: 6,

  baseline: "velastack",

  generate,
} satisfies Pattern;
