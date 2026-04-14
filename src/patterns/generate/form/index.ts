import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { generate as generateBase } from "./generate";

export const GENERATE_FORM_SLUG = "generate-form";

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
  slug: GENERATE_FORM_SLUG,
  title: "Generate a form",
  summary: "Generates a form.",
  categories: ["forms"],
  tags: ["sveltekit", "superforms", "validation", "zod"],

  command: {
    raw: "vela generate form contact name:text email:email message:editor",
    argv: [
      "generate",
      "form",
      "contact",
      "name:text",
      "email:email",
      "message:editor",
    ],
  },

  baseline: "velastack",

  generate: generate,
} satisfies Pattern;
