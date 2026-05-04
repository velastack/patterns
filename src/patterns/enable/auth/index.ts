import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";
import { generate as generatePreview } from "./generate.preview";

const SLUG = "enable-auth" as const;
const VERSION = "1.0.8";
const SOURCE = "src/patterns/enable/auth";
const DOCS = "/enable/auth";

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
  title: "Enable authentication",
  summary: "Enables authentication.",
  requires: {
    auth: false,
    api: false,
    apiKeys: false,
    i18n: false,
    teams: false,
    payments: false,
    blog: false,
    contentNegotiation: false,
  },
  category: "auth" as const,
  tags: [
    "sveltekit",
    "authentication",
    "auth",
    "velastack",
    "oauth",
    "pocketbase",
  ],

  command: {
    raw: "vela enable auth",
    base: "vela enable auth",
    argv: [],
  },

  examples: [],

  tests: 21,

  baseline: "velastack",

  variants: ["split"],

  generate: generate,
} satisfies Pattern;
