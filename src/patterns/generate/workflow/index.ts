import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { InvalidArgumentError } from "../../../core/errors";
import { generate as generateBase } from "./generate";

const SLUG = "generate-workflow" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/generate/workflow";
const DOCS = "/generate/workflow";

export async function generate(options: Options) {
  // The worker and client the generated file imports come with the base
  // template; a project from before then gets them from `enable workflows`.
  if (options.env === "runtime" && !options.features.workflows) {
    throw new InvalidArgumentError(
      "This project has no workflow runtime yet. Run `vela enable workflows` first.",
    );
  }

  const baseRes = await generateBase(options);

  if (options.env !== "runtime") {
    return formatResult(baseRes, options);
  }

  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(await formatResult(baseRes, options), options);
}

export default {
  version: VERSION,
  slug: SLUG,
  source: SOURCE,
  docs: DOCS,
  plan: "open",
  title: "Generate a workflow",
  summary:
    "Adds a durable background workflow to src/lib/workflows, with a server test; --cron makes it recurring.",
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
    cms: false,
    workflows: true,
  },
  category: "generators" as const,
  tags: ["openworkflow", "workflows", "background jobs", "cron", "pocketbase"],

  command: {
    raw: "vela generate workflow send-welcome-email",
    base: "vela generate workflow",
    argv: ["send-welcome-email"],
  },

  examples: [
    {
      command: "send-welcome-email",
      description:
        "A workflow started from server code with sendWelcomeEmail.run(input).",
    },
    {
      command: "sync-prices --cron '*/5 * * * *'",
      description: "A recurring workflow that runs every five minutes.",
    },
  ],

  tests: 1,

  baseline: "velastack",

  generate,
} satisfies Pattern;
