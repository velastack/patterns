import type { Options, Pattern } from "../../../core/types";
import { generate as generateBase } from "./generate";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);
  if (options.env !== "runtime") {
    return baseRes;
  }

  const { createCollections } = await import("../../../runtime/collections");
  const migrationCreates = await createCollections(baseRes.collections, options);
  const runtimeRes = {
    ...baseRes,
    creates: [...baseRes.creates, ...migrationCreates],
  };

  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(runtimeRes, options);
}

export default {
  slug: "generate-resource",
  title: "Generate a resource",
  summary: "Generates model schema resources.",
  categories: ["data"],
  tags: ["pocketbase", "resource", "schema"],

  command: {
    raw: "vela generate resource contact name:text email:email",
    argv: ["generate", "resource", "contact", "name:text", "email:email"],
  },

  baseline: "velastack",

  generate,
} satisfies Pattern;
