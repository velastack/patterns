import type { Options, Pattern } from "../../../core/types";
import { generate as generateBase } from "./generate";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);
  if (options.env !== "runtime") {
    return baseRes;
  }

  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(baseRes, options);
}

export default {
  slug: "generate-schema",
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
