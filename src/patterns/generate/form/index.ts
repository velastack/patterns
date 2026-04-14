import type { Options, Pattern } from "../../../core/types";
import { generate as generateBase } from "./generate";

// Generate entrypoint for the pattern. This function is roughly the same for all patterns.
export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env !== "runtime") {
    return baseRes;
  }

  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(baseRes, options);
}

export default {
  slug: "generate-form",
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
