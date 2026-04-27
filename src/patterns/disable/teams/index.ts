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
  plan: "pro",
  title: "Disable teams",
  summary:
    "Removes teams collections (teams, team_memberships, team_invites, team_invite_links), reverts the Teams nav item, and deletes team routes. app-sidebar and +layout.server.ts must be reverted manually.",
  requires: {
    auth: true,
    api: false,
    apiKeys: false,
    i18n: false,
    teams: true,
    payments: false,
    blog: false,
    contentNegotiation: false,
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
