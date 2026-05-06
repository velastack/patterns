import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { getLogger } from "../../../core/logger";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";
import { generate as generatePreview } from "./generate.preview";

const SLUG = "generate-form-remote" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/generate/form-remote";
const DOCS = "/generate/form-remote";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env === "preview") {
    const previewRes = await generatePreview(options);
    return formatResult(mergeResults([baseRes, previewRes]));
  }

  if (options.env !== "runtime") {
    return formatResult(baseRes);
  }

  const { modifyOutcomeToFile } = await import("../../../runtime/modify-file");
  const { findSvelteConfigPath, modifySvelteConfigRemote } =
    await import("../../../runtime/modify-svelte-config-remote");
  const logger = getLogger(options);
  logger.info("Modifying svelte.config for remote");
  const svelteConfigPath = findSvelteConfigPath(options.root);
  const svelteConfigFile = modifyOutcomeToFile(
    svelteConfigPath,
    modifySvelteConfigRemote(svelteConfigPath),
  );

  const runtimeRes = {
    ...baseRes,
    modifies: [
      ...baseRes.modifies,
      ...(svelteConfigFile ? [svelteConfigFile] : []),
    ],
  };

  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(await formatResult(runtimeRes), options);
}

export default {
  version: VERSION,
  slug: SLUG,
  source: SOURCE,
  docs: DOCS,
  plan: "open",
  title: "Generate a form (remote functions)",
  summary:
    "Generates a form using SvelteKit remote functions instead of sveltekit-superforms.",
  requires: {
    auth: false,
    api: false,
    apiKeys: false,
    backend: false,
    i18n: false,
    teams: false,
    payments: false,
    blog: false,
    contentNegotiation: false,
  },
  category: "generators" as const,
  tags: ["sveltekit", "remote-functions", "validation", "zod"],

  command: {
    raw: "vela generate form --remote contact name:text email:email message:editor",
    base: "vela generate form --remote",
    argv: ["contact", "name:text", "email:email", "message:editor"],
  },

  examples: [
    {
      command: "contact name:text! email:email! message:editor",
      description: "Contact form using remote functions.",
    },
    {
      command: "profile avatar:file bio:editor website:url",
      description: "File upload (multipart) + editor + URL validation.",
    },
    {
      command: "feedback rating:select(1,2,3,4,5) comment:editor",
      description: "Select enum with a long-form comment.",
    },
  ],

  tests: 1,

  baseline: "velastack",

  generate: generate,
} satisfies Pattern;
