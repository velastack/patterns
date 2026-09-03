export class InvalidArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidArgumentError";
  }
}

/**
 * The shadcn-svelte registry could not be read (offline, a proxy, an outage).
 * Callers that only need the registry for a nicety, such as name checks or a
 * listing, catch this and degrade; callers that cannot proceed without it let
 * it surface as-is.
 */
export class RegistryUnavailableError extends Error {
  readonly url: string;

  constructor(url: string, reason: string) {
    super(`Could not read the shadcn-svelte registry at ${url}: ${reason}`);
    this.name = "RegistryUnavailableError";
    this.url = url;
  }
}
