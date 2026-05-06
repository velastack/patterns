import type { File, Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { getLogger } from "../../../core/logger";
import { generate as generateBase } from "./generate";

const SLUG = "generate-migration" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/generate/migration";
const DOCS = "/generate/migration";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env !== "runtime") {
    return formatResult(baseRes);
  }

  const { applyCollectionFieldsPatches } =
    await import("../../../runtime/collections");
  const { withPocketbase } = await import("../../../runtime/pocketbase");

  const logger = getLogger(options);
  let migrationCreates: File[] = [];
  await withPocketbase(options.root, async (pb) => {
    migrationCreates = await applyCollectionFieldsPatches(
      pb,
      baseRes.collectionPatches,
      options,
      logger,
    );
  });

  const runtimeRes = {
    ...baseRes,
    creates: [...baseRes.creates, ...migrationCreates],
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
  title: "Generate a migration",
  summary:
    "Adds, removes, renames, or references fields on an existing collection.",
  requires: {
    auth: false,
    api: false,
    apiKeys: false,
    backend: true,
    i18n: false,
    teams: false,
    payments: false,
    blog: false,
    contentNegotiation: false,
  },
  category: "generators" as const,
  tags: ["pocketbase", "migration", "schema"],

  command: {
    raw: "vela generate migration users add birthday:date",
    base: "vela generate migration",
    argv: ["users", "add", "birthday:date"],
  },

  examples: [
    {
      command: "posts add title:text! body:editor",
      description: "Add two fields to the posts collection.",
    },
    {
      command: "posts remove legacy_flag",
      description: "Drop a deprecated field from the posts collection.",
    },
    {
      command: "posts rename title heading",
      description: "Rename a field on the posts collection.",
    },
    {
      command: "posts references users",
      description: "Add a multi-relation field named users (maxSelect: 999).",
    },
    {
      command: "posts references user",
      description: "Add a single-relation field named user (maxSelect: 1).",
    },
  ],

  tests: 0,

  baseline: "velastack",

  generate,
} satisfies Pattern;
