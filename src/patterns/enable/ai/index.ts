import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase, PROVIDERS } from "./generate";
import { generate as generatePreview } from "./generate.preview";

const SLUG = "enable-ai" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/enable/ai";
const DOCS = "/enable/ai";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env === "preview") {
    const previewRes = await generatePreview(options);
    return formatResult(mergeResults([baseRes, previewRes]), options);
  }

  // Runtime-only modules stay behind dynamic imports so the website's preview
  // bundle never pulls node:fs or ts-morph into SSR.
  const { generate: generateRuntime } = await import("./generate.runtime");
  const runtimeRes = await generateRuntime(options);
  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(
    await formatResult(mergeResults([baseRes, runtimeRes]), options),
    options,
  );
}

export default {
  version: VERSION,
  slug: SLUG,
  source: SOURCE,
  docs: DOCS,
  plan: "open",
  title: "Enable AI",
  summary:
    "Adds the Vercel AI SDK (through Vercel AI Gateway, OpenAI or Anthropic): a streaming /api/chat endpoint and an /ai chat page built on @ai-sdk/svelte.",
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
    raw: "vela enable ai --provider gateway",
    base: "vela enable ai",
    argv: [],
  },

  examples: [
    {
      command: "--provider gateway",
      description:
        "Reach hundreds of models with one AI_GATEWAY_API_KEY through Vercel AI Gateway.",
    },
    {
      command: "--provider openai",
      description:
        "Call OpenAI directly with OPENAI_API_KEY via @ai-sdk/openai.",
    },
    {
      command: "--provider anthropic",
      description:
        "Call Anthropic directly with ANTHROPIC_API_KEY via @ai-sdk/anthropic.",
    },
  ],

  tests: 3,

  baseline: "velastack",

  providers: PROVIDERS,

  generate,
} satisfies Pattern;
