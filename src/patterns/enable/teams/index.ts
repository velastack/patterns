import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";
import { generate as generatePreview } from "./generate.preview";

const SLUG = "enable-teams" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/enable/teams";
const DOCS = "/enable/teams";

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
  plan: "pro",
  title: "Enable teams",
  summary:
    "Adds multi-tenant teams with memberships, invites, and a sidebar team switcher.",
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
    "teams",
    "pocketbase",
    "velastack",
    "multi-tenant",
    "collaboration",
  ],

  command: {
    raw: "vela enable teams",
    base: "vela enable teams",
    argv: [],
  },

  baseline: "velastack",

  generate,
} satisfies Pattern;
