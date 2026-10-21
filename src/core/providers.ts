import type { EnvEdit } from "../runtime/env";
import type { EnvVarSpec } from "../runtime/env-vars-file";
import { InvalidArgumentError } from "./errors";
import type { File, Options, Pattern, Provider, ProviderMarker } from "./types";
import { filesUnderPrefix } from "./util";

type ProviderPattern = Pick<Pattern, "slug" | "providers" | "inheritsProvider">;

/** `analytics` for `enable-analytics`: how the capability is named to users. */
export function capabilityName(slug: string): string {
  return slug.replace(/^enable-/, "");
}

/** `--provider <id>` or `--provider=<id>`, for callers that hand flags through in argv. */
export function providerFromArgv(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--provider") return argv[i + 1];
    if (arg.startsWith("--provider=")) return arg.slice("--provider=".length);
  }
  return undefined;
}

export function unknownProviderMessage(
  name: string,
  raw: string,
  providers: Provider[],
): string {
  return [
    `Unknown provider "${raw}" for ${name}.`,
    "",
    "Available providers:",
    ...providers.map((provider) => `  ${provider.id}`),
  ].join("\n");
}

export function providerChoices(providers: Provider[]): string {
  return `--provider <${providers.map((provider) => provider.id).join("|")}>`;
}

/**
 * What `detectProviders` looks for: the declared markers, else the first env
 * key's declaration in `src/env.ts`. Empty for a provider with neither, which
 * can't be detected.
 */
export function providerMarkers(provider: Provider): ProviderMarker[] {
  if (provider.markers) return provider.markers;
  const first = provider.env?.[0];
  return first ? [{ env: first.key }] : [];
}

/**
 * The provider a generate call should produce, from `input.provider` or
 * `--provider` in argv.
 *
 * An unknown id is rejected with the list of known ones. With no provider at
 * all, a runtime call is rejected too: the CLI always supplies one, so this
 * is a caller bug. A preview call falls back to the first declared provider,
 * because the website loads patterns with argv only.
 *
 * A pattern with `inheritsProvider` takes the provider detected for that
 * capability instead; see `resolveInheritedProvider`.
 */
export function resolveProvider(
  pattern: ProviderPattern,
  options: Pick<Options, "input" | "argv" | "env" | "providers">,
): Provider {
  const providers = pattern.providers ?? [];
  const name = capabilityName(pattern.slug);
  if (providers.length === 0) {
    throw new Error(`${pattern.slug} declares no providers.`);
  }

  const raw =
    typeof options.input.provider === "string"
      ? options.input.provider
      : providerFromArgv(options.argv);

  if (pattern.inheritsProvider) {
    return resolveInheritedProvider(
      pattern.inheritsProvider,
      name,
      providers,
      raw,
      options,
    );
  }

  if (raw === undefined || raw === "") {
    if (options.env === "preview") return providers[0];
    throw new InvalidArgumentError(
      `Choose a provider for ${name}: ${providerChoices(providers)}`,
    );
  }

  const provider = providers.find((candidate) => candidate.id === raw);
  if (!provider) {
    throw new InvalidArgumentError(
      unknownProviderMessage(name, raw, providers),
    );
  }
  return provider;
}

/**
 * A pattern built on another capability uses that capability's provider:
 * enable-ecommerce on a project with Shopify payments generates the Shopify
 * cart. A `--provider` that repeats the detected one is accepted; a different
 * one is an error, because switching means disabling the capability first.
 *
 * In preview nothing is detected, so it falls back like `resolveProvider`.
 */
function resolveInheritedProvider(
  capability: string,
  name: string,
  providers: Provider[],
  raw: string | undefined,
  options: Pick<Options, "env" | "providers">,
): Provider {
  const detectedId = options.providers?.[capability];

  if (detectedId === undefined) {
    if (options.env === "preview") {
      if (raw === undefined || raw === "") return providers[0];
      const provider = providers.find((candidate) => candidate.id === raw);
      if (provider) return provider;
      throw new InvalidArgumentError(
        unknownProviderMessage(name, raw, providers),
      );
    }
    throw new InvalidArgumentError(
      `${name} is built on ${capability}, and this project has none. ` +
        `Run \`vela enable ${capability}\` first.`,
    );
  }

  const detected = providers.find((candidate) => candidate.id === detectedId);
  if (!detected) {
    throw new InvalidArgumentError(
      `${name} does not support "${detectedId}" ${capability} yet. ` +
        `Supported: ${providers.map((provider) => provider.id).join(", ")}.`,
    );
  }

  if (raw !== undefined && raw !== "" && raw !== detectedId) {
    throw new InvalidArgumentError(
      `This project uses ${detected.label} ${capability}, and ${name} follows it. ` +
        `Leave out --provider, or pass --provider ${detectedId}.`,
    );
  }

  return detected;
}

/**
 * The `.env` lines for a provider: `# heading`, then one `KEY=value` per
 * declared env var. `supplied` holds what the CLI collected; a blank value
 * falls back to the provider's default, else an empty assignment the
 * developer fills in later. Prompt placeholders are never written.
 */
export function providerEnvEdits(
  provider: Provider,
  heading: string,
  supplied: Record<string, string> = {},
): EnvEdit[] {
  return [
    { type: "comment", key: heading },
    ...(provider.env ?? []).map((variable): EnvEdit => ({
      type: "var",
      key: variable.key,
      value: supplied[variable.key]?.trim() || variable.default || "",
    })),
  ];
}

/**
 * The `src/env.ts` declarations for a provider's env vars: optional, so an
 * empty `.env` still builds, and public only where the provider says so.
 */
export function providerEnvVars(provider: Provider): EnvVarSpec[] {
  return (provider.env ?? []).map((variable) => ({
    name: variable.key,
    ...(variable.public ? { public: true } : {}),
    description: variable.description ?? variable.label,
  }));
}

/** The string values of `input.providerEnv`, as the CLI collected them. */
export function suppliedProviderEnv(
  options: Pick<Options, "input">,
): Record<string, string> {
  const raw = options.input.providerEnv;
  if (!raw || typeof raw !== "object") return {};
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

/**
 * Every app-relative path the providers create, sorted, for a disable pattern
 * that removes the files whichever provider was chosen. Works on a glob taken
 * from anywhere (`../../enable/<x>/providers/**`): only the part after
 * `providers/<id>/` (or `providers-<variant>/<id>/`) counts. `id` limits it to
 * one provider's files.
 */
export function allProviderPaths(
  providersRaw: Record<string, string>,
  id?: string,
): string[] {
  const paths = new Set<string>();
  for (const key of Object.keys(providersRaw)) {
    const match = key.match(/\/providers(?:-[^/]+)?\/([^/]+)\/(.+)$/);
    if (match && (id === undefined || match[1] === id)) paths.add(match[2]);
  }
  return [...paths].sort();
}

/**
 * The files under `providers/<id>/**` of a pattern, as creates. The glob map
 * is one `import.meta.glob("./providers/**")` covering every provider. `root`
 * names a sibling tree for a variant of the provider's files, such as
 * `./providers-app-mode/`.
 */
export function providerCreates(
  providersRaw: Record<string, string>,
  id: string,
  root = "./providers/",
): File[] {
  const files = filesUnderPrefix(providersRaw, `${root}${id}/`);
  return Object.values(files).sort((a, b) => a.path.localeCompare(b.path));
}
