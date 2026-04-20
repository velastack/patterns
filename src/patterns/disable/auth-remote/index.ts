import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";

const SLUG = "disable-auth-remote" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/disable/auth-remote";
const DOCS = "/disable/auth-remote";

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
  title: "Disable authentication (remote functions)",
  summary:
    "Reverts remote-functions auth integration: removes auth routes, reverts layout/hooks edits, drops oauth_accounts. Does NOT delete the users collection, user data, or revert svelte.config.",
  requires: {
    auth: true,
    api: false,
    apiKeys: false,
    i18n: false,
    teams: false,
    payments: false,
  },
  category: "auth" as const,
  tags: [
    "sveltekit",
    "authentication",
    "auth",
    "velastack",
    "oauth",
    "pocketbase",
    "remote-functions",
  ],

  command: {
    raw: "vela disable auth --remote",
    base: "vela disable auth --remote",
    argv: [],
  },

  examples: [],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
