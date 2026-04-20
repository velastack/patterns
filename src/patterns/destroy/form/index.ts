import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { generate as generateForward } from "../../generate/form/generate";
import { inverseCreates } from "../shared";

const SLUG = "destroy-form" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/destroy/form";
const DOCS = "/destroy/form";

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
  title: "Destroy a form",
  summary: "Removes the form files created by generate-form.",
  requires: {
    auth: false,
    api: false,
    apiKeys: false,
    i18n: false,
    teams: false,
    payments: false,
  },
  category: "generators" as const,
  tags: ["form", "sveltekit", "pocketbase"],

  command: {
    raw: "vela destroy form contact name:text email:email",
    base: "vela destroy form",
    argv: ["contact", "name:text", "email:email"],
  },

  examples: [
    {
      command: "login email:email! password:text!",
      description: "Remove the login form.",
    },
  ],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
