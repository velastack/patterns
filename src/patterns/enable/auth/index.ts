import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";
import { generate as generatePreview } from "./generate.preview";

export const ENABLE_AUTH_SLUG = "enable-auth";

// Generate entrypoint for the pattern. This function is roughly the same for all patterns.
export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env === "preview") {
    const previewRes = await generatePreview(options);
    return formatResult(mergeResults([baseRes, previewRes]));
  }

  const { generate: generateRuntime } = await import("./generate.runtime");
  const runtimeRes = await generateRuntime(options);
  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(await formatResult(mergeResults([baseRes, runtimeRes])), options);
}

export default {
  slug: ENABLE_AUTH_SLUG,
  title: "Enable authentication",
  summary: "Enables authentication.",
  categories: ["authentication"],
  tags: [
    "sveltekit",
    "authentication",
    "auth",
    "velastack",
    "oauth",
    "pocketbase",
  ],

  command: {
    raw: "vela enable auth",
    argv: ["enable", "auth"],
  },

  baseline: "velastack",

  generate: generate,
} satisfies Pattern;
