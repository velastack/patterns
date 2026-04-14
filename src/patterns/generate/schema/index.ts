import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { generate as generateBase } from "./generate";

export const GENERATE_SCHEMA_SLUG = "generate-schema";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env !== "runtime") {
    return formatResult(baseRes);
  }

  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(await formatResult(baseRes), options);
}

export default {
  slug: GENERATE_SCHEMA_SLUG,
  title: "Generate a schema",
  summary: "Generates a zod schema.",
  categories: ["data"],
  tags: ["zod", "schema", "pocketbase"],

  command: {
    raw: "vela generate schema contact name:text email:email",
    argv: ["generate", "schema", "contact", "name:text", "email:email"],
  },

  baseline: "velastack",

  generate,
} satisfies Pattern;
