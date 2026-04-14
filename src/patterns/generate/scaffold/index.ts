import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { generate as generateBase } from "./generate";

export const GENERATE_SCAFFOLD_SLUG = "generate-scaffold";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env !== "runtime") {
    return formatResult(baseRes);
  }

  const { createCollections } = await import("../../../runtime/collections");
  const migrationCreates = await createCollections(baseRes.collections, options);
  const runtimeRes = {
    ...baseRes,
    creates: [...baseRes.creates, ...migrationCreates],
  };

  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(await formatResult(runtimeRes), options);
}

export default {
  slug: GENERATE_SCAFFOLD_SLUG,
  title: "Generate a scaffold",
  summary: "Generates CRUD routes and schema.",
  categories: ["data", "forms"],
  tags: ["crud", "scaffold", "pocketbase", "sveltekit"],

  command: {
    raw: "vela generate scaffold contact name:text email:email",
    argv: ["generate", "scaffold", "contact", "name:text", "email:email"],
  },

  baseline: "velastack",

  generate,
} satisfies Pattern;
