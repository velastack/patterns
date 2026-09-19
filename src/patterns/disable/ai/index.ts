import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";

const SLUG = "disable-ai" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/disable/ai";
const DOCS = "/disable/ai";

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
  title: "Disable AI",
  summary:
    "Removes the AI SDK model module, the /api/chat endpoint and the /ai demo page, strips the provider's API key from .env and uninstalls the AI SDK packages.",
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
  category: "ai" as const,
  tags: [
    "sveltekit",
    "ai",
    "ai-sdk",
    "chat",
    "vercel-ai-gateway",
    "openai",
    "anthropic",
    "velastack",
  ],

  command: {
    raw: "vela disable ai",
    base: "vela disable ai",
    argv: [],
  },

  examples: [],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
