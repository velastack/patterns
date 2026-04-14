import type { Options, Pattern } from "../../../core/types";
import { generate as generateBase } from "./generate";

// Generate entrypoint for the pattern. This function is roughly the same for all patterns.
export async function generate(options: Options) {
  // Base generation logic, this is the same for both runtime and preview. As much as possible should be done here.
  const baseRes = await generateBase(options);

  // Write the create files to the filesystem
  // Install packages
  // Install shadcn-svelte components (replace components array with the returned array containing only the new components)

  return baseRes;
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
