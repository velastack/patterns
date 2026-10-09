import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { InvalidArgumentError } from "../../../core/errors";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";
import { generate as generatePreview } from "./generate.preview";

const SLUG = "enable-whatsapp" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/enable/whatsapp";
const DOCS = "/enable/whatsapp";

export async function generate(options: Options) {
  if (options.env === "runtime" && !options.features.auth) {
    throw new InvalidArgumentError(
      "WhatsApp sign-in goes on the login and signup pages. Run `vela enable auth` first.",
    );
  }

  if (options.env === "preview") {
    const baseRes = await generateBase(options);
    const previewRes = await generatePreview(options);
    return formatResult(mergeResults([baseRes, previewRes]), options);
  }

  // Runtime-only modules stay behind dynamic imports so the website's preview
  // bundle never pulls node:fs, prettier or ts-morph into SSR.
  const { detectMode } = await import("./modifies/auth-pages");
  const { keepMissing } = await import("../../../runtime/modify-file");
  const baseRes = await generateBase(options, detectMode(options.root));

  const { generate: generateRuntime } = await import("./generate.runtime");
  const runtimeRes = await generateRuntime(options);
  const { writeResult } = await import("../../../runtime/write-result");
  return writeResult(
    await formatResult(
      mergeResults([
        // A re-run keeps the code page and helpers as the project has them.
        { ...baseRes, creates: keepMissing(baseRes.creates, options.root) },
        runtimeRes,
      ]),
      options,
    ),
    options,
  );
}

export default {
  version: VERSION,
  slug: SLUG,
  source: SOURCE,
  docs: DOCS,
  plan: "open",
  title: "Enable WhatsApp sign-in",
  summary:
    "Adds sign-in and signup with a code sent on WhatsApp to the login and signup pages, next to email. Requires enable-auth.",
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
    // The pages are shadcn-svelte markup; there is no plain variant.
    ui: "shadcn",
  },
  category: "auth" as const,
  tags: [
    "sveltekit",
    "authentication",
    "auth",
    "whatsapp",
    "otp",
    "pocketbase",
    "velastack",
  ],

  command: {
    raw: "vela enable whatsapp",
    base: "vela enable whatsapp",
    argv: [],
  },

  examples: [],

  tests: 2,

  baseline: "velastack",

  generate,
} satisfies Pattern;
