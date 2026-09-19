import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";

const SLUG = "disable-backend" as const;
const VERSION = "1.0.1";
const SOURCE = "src/patterns/disable/backend";
const DOCS = "/disable/backend";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env !== "runtime") {
    return formatResult(baseRes, options);
  }

  const { generate: generateRuntime } = await import("./generate.runtime");
  const runtimeRes = await generateRuntime(options);
  // The runtime reverts hooks.server.ts instead of deleting it, so handles
  // other patterns composed in survive; it reports a delete when nothing did.
  const merged = await formatResult(
    mergeResults([
      {
        ...baseRes,
        deletes: baseRes.deletes.filter(
          (file) => file.path !== "src/hooks.server.ts",
        ),
      },
      runtimeRes,
    ]),
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
  title: "Disable Backend",
  summary:
    "Removes the PocketBase backend wiring: deletes hooks.server.ts, the data/ scaffold and the background workflows (which run on PocketBase), switches the SvelteKit adapter back to static with SPA fallback, and reverts test/setup.ts. Leaves @velastack/pocketbase and pocketbase-sveltekit installed; uninstall manually.",
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
