import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { generate as generateBase } from "./generate";

const SLUG = "generate-scaffold" as const;
const VERSION = "1.0.7";
const SOURCE = "src/patterns/generate/scaffold";
const DOCS = "/generate/scaffold";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env !== "runtime") {
    return formatResult(baseRes);
  }

  const { createCollections } = await import("../../../runtime/collections");
  const migrationCreates = await createCollections(
    baseRes.collections,
    options,
  );
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
  title: "Generate a scaffold",
  summary: "Generates CRUD routes and schema.",
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
  tags: ["crud", "scaffold", "pocketbase", "sveltekit"],

  command: {
    raw: "vela generate scaffold contact name:text email:email",
    base: "vela generate scaffold",
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
      command: "pet name:text! breed:text! owner:current_user",
      description: "Auth-bound owner relation.",
    },
    {
      command:
        'project name:text! status:select(active,done) --route "(app)/[team_id]/projects"',
      description:
        "Team-scoped CRUD via dynamic route param. Generated hrefs and redirects interpolate params.team_id.",
    },
  ],

  tests: 8,

  baseline: "velastack",

  generate,
} satisfies Pattern;
