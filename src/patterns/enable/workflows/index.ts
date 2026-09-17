import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";
import { generate as generatePreview } from "./generate.preview";

const SLUG = "enable-workflows" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/enable/workflows";
const DOCS = "/enable/workflows";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env === "preview") {
    const previewRes = await generatePreview(options);
    return formatResult(mergeResults([baseRes, previewRes]), options);
  }

  const { generate: generateRuntime } = await import("./generate.runtime");
  const runtimeRes = await generateRuntime(options);
  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(
    await formatResult(mergeResults([baseRes, runtimeRes]), options),
    options,
  );
}

/**
 * The upgrade path. Projects created from the base template already carry
 * `src/lib/server/workflows.ts`, `src/lib/workflows/` and the `init` hook;
 * this brings a project created before that up to the same shape. The files
 * it creates are the template's, byte for byte, so on a current project it
 * changes nothing.
 */
export default {
  version: VERSION,
  slug: SLUG,
  source: SOURCE,
  docs: DOCS,
  plan: "open",
  title: "Enable workflows",
  summary:
    "Adds durable background workflows on the OpenWorkflow engine built into PocketBase: a worker started from hooks.server.ts, src/lib/workflows/ for workflow modules, and cron support for recurring ones.",
  requires: {
    auth: false,
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
  category: "backend" as const,
  tags: [
    "sveltekit",
    "pocketbase",
    "openworkflow",
    "workflows",
    "background jobs",
    "cron",
    "velastack",
  ],

  command: {
    raw: "vela enable workflows",
    base: "vela enable workflows",
    argv: [],
  },

  examples: [],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
