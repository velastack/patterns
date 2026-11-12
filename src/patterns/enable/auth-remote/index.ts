import type { Options, Pattern } from "../../../core/types";
import { formatResult } from "../../../core/format-result";
import { mergeResults } from "../../../core/util";
import { generate as generateBase } from "./generate";
import { generate as generatePreview } from "./generate.preview";

const SLUG = "enable-auth-remote" as const;
const VERSION = "1.3.0";
const SOURCE = "src/patterns/enable/auth-remote";
const DOCS = "/enable/auth-remote";

export async function generate(options: Options) {
  const baseRes = await generateBase(options);

  if (options.env === "preview") {
    const previewRes = await generatePreview(options);
    return formatResult(mergeResults([baseRes, previewRes]), options);
  }

  const { createCollections } = await import("../../../runtime/collections");
  const migrationCreates = await createCollections(
    baseRes.collections,
    options,
  );

  const { generate: generateRuntime } = await import("./generate.runtime");
  const runtimeRes = await generateRuntime(options);
  const { writeResult } = await import("../../../runtime/write-result");
  const written = await writeResult(
    await formatResult(
      mergeResults([
        { ...baseRes, creates: [...baseRes.creates, ...migrationCreates] },
        runtimeRes,
      ]),
      options,
    ),
    options,
  );

  // In a project that already has i18n: the language select and the Spanish
  // enable-i18n would have added had these pages been there when it ran.
  // After the write, because both read the pages from disk.
  const { localizeAuthPages } = await import("../auth/i18n");
  const localized = localizeAuthPages(options);
  if (localized.creates.length === 0 && localized.modifies.length === 0) {
    return written;
  }
  const writtenLocalized = await writeResult(
    await formatResult(
      {
        creates: localized.creates,
        modifies: localized.modifies,
        deletes: [],
        components: [],
        packages: [],
        collections: [],
        collectionPatches: [],
        collectionDrops: [],
      },
      options,
    ),
    options,
  );
  return mergeResults([written, writtenLocalized]);
}

export default {
  version: VERSION,
  slug: SLUG,
  source: SOURCE,
  docs: DOCS,
  plan: "open",
  title: "Enable authentication (remote functions)",
  summary:
    "Enables authentication using SvelteKit remote functions for login, signup, reset, and settings forms.",
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
    // The pages are shadcn-svelte markup; there is no plain variant.
    ui: "shadcn",
  },
  category: "auth" as const,
  tags: [
    "sveltekit",
    "authentication",
    "auth",
    "velastack",
    "oauth",
    "pocketbase",
    "remote-functions",
  ],

  command: {
    raw: "vela enable auth --remote",
    base: "vela enable auth --remote",
    argv: [],
  },

  examples: [],

  tests: 20,

  baseline: "velastack",

  generate: generate,
} satisfies Pattern;
