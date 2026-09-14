import { InvalidArgumentError } from "./errors";
import type { File, Options, Pattern, Provider } from "./types";
import { filesUnderPrefix } from "./util";

type ProviderPattern = Pick<Pattern, "slug" | "providers">;

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
 * The provider a generate call should produce, from `input.provider` or
 * `--provider` in argv.
 *
 * An unknown id is rejected with the list of known ones. With no provider at
 * all, a runtime call is rejected too: the CLI always supplies one, so this
 * is a caller bug. A preview call falls back to the first declared provider,
 * because the website loads patterns with argv only.
 */
export function resolveProvider(
  pattern: ProviderPattern,
  options: Pick<Options, "input" | "argv" | "env">,
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
 * The files under `providers/<id>/**` of a pattern, as creates. The glob map
 * is one `import.meta.glob("./providers/**")` covering every provider.
 */
export function providerCreates(
  providersRaw: Record<string, string>,
  id: string,
): File[] {
  const files = filesUnderPrefix(providersRaw, `./providers/${id}/`);
  return Object.values(files).sort((a, b) => a.path.localeCompare(b.path));
}
