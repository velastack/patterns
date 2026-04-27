import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { getLogger } from "../../../core/logger";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";
import { generate as generatePreview } from "./generate.preview";

const SLUG = "generate-scaffold-remote" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/generate/scaffold-remote";
const DOCS = "/generate/scaffold-remote";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env === "preview") {
    const previewRes = await generatePreview(options);
    return formatResult(mergeResults([baseRes, previewRes]));
  }

  if (options.env !== "runtime") {
    return formatResult(baseRes);
  }

  const { createCollections } = await import("../../../runtime/collections");
  const migrationCreates = await createCollections(
    baseRes.collections,
    options,
  );

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
    creates: [...baseRes.creates, ...migrationCreates],
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
  title: "Generate a scaffold (remote functions)",
  summary:
    "Generates CRUD routes and schema using SvelteKit remote functions for create/update forms.",
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
  tags: ["crud", "scaffold", "pocketbase", "sveltekit", "remote-functions"],

  command: {
    raw: "vela generate scaffold --remote contact name:text email:email",
    base: "vela generate scaffold --remote",
    argv: ["contact", "name:text", "email:email"],
  },

  examples: [
    {
      command: "todos title:text! done:bool",
      description: "Todos with required title and boolean flag.",
    },
    {
      command: "pets type:select(dog:Dog,cat:Cat) owner:user",
      description: "Enum field and a one-to-many relation to user.",
    },
    {
      command: "users/pets name:text! author:current_user",
      description: "Nested resource with auth-bound author.",
    },
  ],

  tests: 6,

  baseline: "velastack",

  generate,
} satisfies Pattern;
