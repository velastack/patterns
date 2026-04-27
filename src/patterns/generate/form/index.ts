import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { generate as generateBase } from "./generate";

const SLUG = "generate-form" as const;
const VERSION = "1.0.7";
const SOURCE = "src/patterns/generate/form";
const DOCS = "/generate/form";

// Generate entrypoint for the pattern. This function is roughly the same for all patterns.
export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env !== "runtime") {
    return formatResult(baseRes);
  }

  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(await formatResult(baseRes), options);
}

export default {
  version: VERSION,
  slug: SLUG,
  source: SOURCE,
  docs: DOCS,
  plan: "open",
  title: "Generate a form",
  summary: "Generates a form.",
  requires: {
    auth: false,
    api: false,
    apiKeys: false,
    i18n: false,
    teams: false,
    payments: false,
    blog: false,
    contentNegotiation: false,
  },
  category: "generators" as const,
  tags: ["sveltekit", "superforms", "validation", "zod"],

  command: {
    raw: "vela generate form contact name:text email:email message:editor",
    base: "vela generate form",
    argv: ["contact", "name:text", "email:email", "message:editor"],
  },

  examples: [
    {
      command: "contact name:text! email:email! message:editor",
      description: "Contact form with required text fields and a rich editor.",
    },
    {
      command: "profile avatar:file bio:editor website:url",
      description: "File upload, editor, and URL validation.",
    },
    {
      command: "feedback rating:select(1,2,3,4,5) comment:editor",
      description: "Select enum with a long-form comment.",
    },
  ],

  tests: 2,

  baseline: "velastack",

  generate: generate,
} satisfies Pattern;
