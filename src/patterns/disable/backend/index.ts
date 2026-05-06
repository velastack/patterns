import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";

const SLUG = "disable-backend" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/disable/backend";
const DOCS = "/disable/backend";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env !== "runtime") {
    return formatResult(baseRes);
  }

  const { generate: generateRuntime } = await import("./generate.runtime");
  const runtimeRes = await generateRuntime(options);
  const merged = await formatResult(mergeResults([baseRes, runtimeRes]));

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
  title: "Disable Backend",
  summary:
    "Removes the PocketBase backend wiring: deletes hooks.server.ts and the data/ scaffold, switches the SvelteKit adapter back to static with SPA fallback, and reverts test/setup.ts. Leaves @velastack/pocketbase and pocketbase-sveltekit installed; uninstall manually.",
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
  },
  category: "backend" as const,
  tags: ["sveltekit", "pocketbase", "backend", "velastack"],

  command: {
    raw: "vela disable backend",
    base: "vela disable backend",
    argv: [],
  },

  examples: [],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
