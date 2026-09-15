import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";

const SLUG = "disable-teams" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/disable/teams";
const DOCS = "/disable/teams";

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
  plan: "pro",
  title: "Disable teams",
  summary:
    "Removes the teams collections and routes, and reverts the Teams nav item, the team switcher in app-sidebar, the team props in the (app) layout, and the team loader in its +layout.server.ts.",
  requires: {
    auth: true,
    api: false,
    apiKeys: false,
    backend: true,
    i18n: false,
    teams: true,
    payments: false,
    blog: false,
    contentNegotiation: false,
    cms: false,
  },
  category: "auth" as const,
  tags: ["teams", "pocketbase", "velastack", "sveltekit"],

  command: {
    raw: "vela disable teams",
    base: "vela disable teams",
    argv: [],
  },

  examples: [],

  tests: 0,

  baseline: "velastack-auth",

  generate,
} satisfies Pattern;
