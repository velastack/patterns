import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { generate as generateForward } from "../../generate/form-remote/generate";
import { inverseCreates } from "../shared";

const SLUG = "destroy-form-remote" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/destroy/form-remote";
const DOCS = "/destroy/form-remote";

export async function generate(options: Options) {
  const forwardRes = await generateForward(options);
  const inverseRes = inverseCreates(forwardRes);
  const formatted = await formatResult(inverseRes);

  if (options.env !== "runtime" || options.input.destructive !== true) {
    return formatted;
  }

  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(formatted, options);
}

export default {
  version: VERSION,
  slug: SLUG,
  source: SOURCE,
  docs: DOCS,
  plan: "open",
  title: "Destroy a form (remote functions)",
  summary:
    "Removes the remote-function form files created by generate-form --remote. Does not revert svelte.config.",
  requires: {
    auth: false,
    api: false,
    apiKeys: false,
    i18n: false,
    teams: false,
    payments: false,
  },
  category: "generators" as const,
  tags: ["sveltekit", "remote-functions", "validation", "zod"],

  command: {
    raw: "vela destroy form --remote contact name:text email:email",
    base: "vela destroy form --remote",
    argv: ["contact", "name:text", "email:email"],
  },

  examples: [
    {
      command: "contact name:text! email:email!",
      description: "Remove a remote-functions contact form.",
    },
  ],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
