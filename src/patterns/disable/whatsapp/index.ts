import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";

const SLUG = "disable-whatsapp" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/disable/whatsapp";
const DOCS = "/disable/whatsapp";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  // Turning WhatsApp off in PocketBase and rewriting the pages only happens
  // with consent; without it this lists the files that would go.
  if (options.env !== "runtime" || options.input.destructive !== true) {
    return formatResult(baseRes, options);
  }

  const { generate: generateRuntime } = await import("./generate.runtime");
  const runtimeRes = await generateRuntime(options);
  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(
    await formatResult(mergeResults([baseRes, runtimeRes]), options),
    options,
  );
}

export default {
  version: VERSION,
  slug: SLUG,
  source: SOURCE,
  docs: DOCS,
  plan: "open",
  title: "Disable WhatsApp sign-in",
  summary:
    "Takes WhatsApp sign-in off the login and signup pages and turns it off in PocketBase. Keeps the phone fields on users and email optional, since they hold user data.",
  requires: {
    auth: true,
    api: false,
    apiKeys: false,
    backend: true,
    i18n: false,
    teams: false,
    payments: false,
    blog: false,
    contentNegotiation: false,
    cms: false,
  },
  category: "auth" as const,
  tags: ["auth", "whatsapp", "sveltekit", "pocketbase", "velastack"],

  command: {
    raw: "vela disable whatsapp",
    base: "vela disable whatsapp",
    argv: [],
  },

  examples: [],

  tests: 0,

  baseline: "velastack-auth",

  generate,
} satisfies Pattern;
