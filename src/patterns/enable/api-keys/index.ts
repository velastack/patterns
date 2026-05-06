import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";
import { generate as generatePreview } from "./generate.preview";

const SLUG = "enable-api-keys" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/enable/api-keys";
const DOCS = "/enable/api-keys";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env === "preview") {
    const previewRes = await generatePreview(options);
    return formatResult(mergeResults([baseRes, previewRes]));
  }

  const { createCollections } = await import("../../../runtime/collections");
  const migrationCreates = await createCollections(
    baseRes.collections,
    options,
  );

  const { generate: generateRuntime } = await import("./generate.runtime");
  const runtimeRes = await generateRuntime(options);
  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(
    await formatResult(
      mergeResults([
        { ...baseRes, creates: [...baseRes.creates, ...migrationCreates] },
        runtimeRes,
      ]),
    ),
    options,
  );
}

export default {
  version: VERSION,
  slug: SLUG,
  source: SOURCE,
  docs: DOCS,
  plan: "open",
  title: "Enable API keys",
  summary:
    "Adds API key management for authenticated users and PocketBase API access.",
  requires: {
    auth: true,
    api: true,
    apiKeys: false,
    backend: true,
    i18n: false,
    teams: false,
    payments: false,
    blog: false,
    contentNegotiation: false,
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
    raw: "vela enable api-keys",
    base: "vela enable api-keys",
    argv: [],
  },

  examples: [],

  tests: 6,

  baseline: "velastack",

  generate,
} satisfies Pattern;
