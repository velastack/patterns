import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";
import { generate as generatePreview } from "./generate.preview";

const SLUG = "enable-og" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/enable/og";
const DOCS = "/enable/og";

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
  title: "Enable Open Graph images",
  summary:
    "Generates a share card for every page from a Svelte component: files at build time for prerendered pages, on request for the rest.",
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
  tags: ["sveltekit", "open-graph", "og-image", "seo", "takumi", "velastack"],

  command: {
    raw: "vela enable og",
    base: "vela enable og",
    argv: [],
  },

  examples: [],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
