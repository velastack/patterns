import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";
import { generate as generatePreview } from "./generate.preview";

const SLUG = "enable-backend" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/enable/backend";
const DOCS = "/enable/backend";

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
  title: "Enable Backend",
  summary:
    "Adds the PocketBase backend: installs @velastack/pocketbase and pocketbase-sveltekit, wires up hooks.server.ts, scaffolds the data/ directory, and switches the SvelteKit adapter from static to auto.",
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
  },
  category: "backend" as const,
  tags: ["sveltekit", "pocketbase", "backend", "velastack"],

  command: {
    raw: "vela enable backend",
    base: "vela enable backend",
    argv: [],
  },

  examples: [],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
