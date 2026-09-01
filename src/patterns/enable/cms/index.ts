import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";
import { generate as generatePreview } from "./generate.preview";

const SLUG = "enable-cms" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/enable/cms";
const DOCS = "/enable/cms";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env === "preview") {
    const previewRes = await generatePreview(options);
    return formatResult(mergeResults([baseRes, previewRes]));
  }

  // Runtime-only modules stay behind dynamic imports so the website's preview
  // bundle never pulls node:fs or ts-morph into SSR.
  const { generate: generateRuntime, keepMissing } =
    await import("./generate.runtime");
  const runtimeRes = await generateRuntime(options);
  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(
    await formatResult(
      mergeResults([
        { ...baseRes, creates: keepMissing(baseRes.creates, options.root) },
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
  title: "Enable CMS",
  summary:
    "Adds an inline-editing CMS with an admin bar, served from the app's own backend.",
  requires: {
    auth: false,
    api: false,
    apiKeys: false,
    // The backend runs inside the app's server, so the site needs a runtime.
    // A prerendered site would fetch a `prerender = false` endpoint during
    // its own build.
    backend: true,
    i18n: false,
    teams: false,
    payments: false,
    blog: false,
    contentNegotiation: false,
    cms: false,
  },
  category: "content" as const,
  tags: [
    "sveltekit",
    "cms",
    "content",
    "inline-editing",
    "sqlite",
    "velastack",
  ],

  command: {
    raw: "vela enable cms",
    base: "vela enable cms",
    argv: [],
  },

  examples: [],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
