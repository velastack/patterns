import type {
  File,
  Options,
  Package,
  Provider,
  Result,
} from "../../../core/types";
import type { EnvEdit } from "../../../runtime/env";
import { ZOD } from "../../../core/constants";
import { resolveUi } from "../../../core/field/ui";
import {
  providerCreates,
  providerEnvEdits,
  resolveProvider,
} from "../../../core/providers";
import { composeCreates, filesFromGlob } from "../../../core/util";
import { defaultGroup } from "../../../parse/route";

/**
 * The providers in prompt order. Each one's `env` key is what the CLI asks
 * for (without echo) and what `generate.runtime.ts` writes to `.env`; the
 * generated `src/lib/server/ai.ts` reads it through `$env/dynamic/private`,
 * and `/api/chat` answers 503 while it is blank.
 */
export const PROVIDERS: Provider[] = [
  {
    id: "gateway",
    label: "Vercel AI Gateway",
    env: [
      {
        key: "AI_GATEWAY_API_KEY",
        label: "Vercel AI Gateway API key",
        secret: true,
      },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    env: [
      {
        key: "OPENAI_API_KEY",
        label: "OpenAI API key",
        placeholder: "sk-...",
        secret: true,
      },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    env: [
      {
        key: "ANTHROPIC_API_KEY",
        label: "Anthropic API key",
        placeholder: "sk-ant-...",
        secret: true,
      },
    ],
  },
];

/**
 * `ai` carries the gateway provider itself; the others are a package each.
 * zod, a peer of `ai`, is installed alongside but is not listed here: it is
 * not the pattern's to uninstall.
 */
export const PACKAGES: Package[] = ["ai@^7.0.107", "@ai-sdk/svelte@^5.0.107"];
export const PROVIDER_PACKAGES: Record<string, Package[]> = {
  openai: ["@ai-sdk/openai@^4.0.71"],
  anthropic: ["@ai-sdk/anthropic@^4.0.58"],
};

/** What `resolveProvider` needs; `index.ts` spreads the rest of the metadata. */
export const META = { slug: "enable-ai", providers: PROVIDERS };

/** Where the demo page is stored; `generate` moves it to the project's default group. */
export const DEMO_DIR = "src/routes/(public)/ai/";

/**
 * The demo page's directory: `(public)/ai`, `(app)/ai` behind sign-in when
 * auth is on, or `ai` straight under `src/routes` in a project without groups.
 */
export function demoDir(
  options: Pick<Options, "features" | "routeGroups">,
): string {
  return ["src/routes", defaultGroup(options), "ai"].filter(Boolean).join("/");
}

/** The `.env` lines for a provider, under a `# AI SDK (<Label>)` heading. */
export function envEditsFor(
  provider: Provider,
  supplied: Record<string, string> = {},
): EnvEdit[] {
  return providerEnvEdits(provider, `AI SDK (${provider.label})`, supplied);
}

const createsRaw = import.meta.glob<string>("./creates/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

// With auth, the endpoint answers only signed-in users: every reply is
// billed to the project's API key.
const createsAppModeRaw = import.meta.glob<string>("./creates-app-mode/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

// A plain project gets the demo page in native elements, at the same path.
const variantsRaw = import.meta.glob<string>("./variants/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const providersRaw = import.meta.glob<string>("./providers/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

export async function generate(options: Options) {
  const provider = resolveProvider(META, options);
  const ui = resolveUi(options);
  const serverTests = options.input.serverTests ?? true;

  const files: Record<string, File> = {};
  const add = (list: File[]) => {
    for (const file of list) files[file.path] = file;
  };
  add(
    composeCreates(
      createsRaw,
      "./creates/",
      variantsRaw,
      ui === "plain" ? "plain" : undefined,
    ),
  );
  if (options.features.auth) {
    add(Object.values(filesFromGlob(createsAppModeRaw, "./creates-app-mode/")));
  }
  add(providerCreates(providersRaw, provider.id));

  const target = `${demoDir(options)}/`;
  const creates = Object.values(files)
    .filter((file) => serverTests || !file.path.endsWith("server.test.ts"))
    .map((file) =>
      file.path.startsWith(DEMO_DIR)
        ? { ...file, path: target + file.path.slice(DEMO_DIR.length) }
        : file,
    )
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    creates,
    modifies: [],
    deletes: [],
    components: ui === "plain" ? [] : ["button", "textarea"],
    // vela's templates already have zod; a project vela did not create may not.
    packages: [...PACKAGES, ZOD, ...(PROVIDER_PACKAGES[provider.id] ?? [])],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
