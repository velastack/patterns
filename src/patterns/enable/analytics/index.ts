import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase, PROVIDERS } from "./generate";
import { generate as generatePreview } from "./generate.preview";

const SLUG = "enable-analytics" as const;
const VERSION = "1.0.0";
const SOURCE = "src/patterns/enable/analytics";
const DOCS = "/enable/analytics";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env === "preview") {
    const previewRes = await generatePreview(options);
    return formatResult(mergeResults([baseRes, previewRes]), options);
  }

  // Runtime-only modules stay behind dynamic imports so the website's preview
  // bundle never pulls node:fs or ts-morph into SSR.
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
  title: "Enable analytics",
  summary:
    "Adds a web analytics component (Plausible, Google Analytics or PostHog) mounted in the root layout and configured from .env.",
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
    cms: false,
  },
  category: "analytics" as const,
  tags: [
    "sveltekit",
    "analytics",
    "plausible",
    "google-analytics",
    "posthog",
    "velastack",
  ],

  command: {
    raw: "vela enable analytics --provider plausible",
    base: "vela enable analytics",
    argv: [],
  },

  examples: [
    {
      command: "--provider plausible",
      description:
        "Load the Plausible script for the site named by PUBLIC_PLAUSIBLE_DOMAIN.",
    },
    {
      command: "--provider google",
      description:
        "Load gtag.js for PUBLIC_GA_MEASUREMENT_ID and send a page_view on every navigation.",
    },
    {
      command: "--provider posthog",
      description:
        "Initialise posthog-js with PUBLIC_POSTHOG_KEY and PUBLIC_POSTHOG_HOST.",
    },
  ],

  tests: 0,

  baseline: "velastack",

  providers: PROVIDERS,

  generate,
} satisfies Pattern;
