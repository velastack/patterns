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

/**
 * The project has no shadcn-svelte setup (`components.json`), and what was
 * asked for cannot be done without one. Raised before anything is written, so
 * the project is left as it was.
 */
export class MissingShadcnError extends Error {
  constructor(what: string) {
    super(
      `${what} needs shadcn-svelte, and this project has no components.json.\n\n` +
        "Set it up with `npx shadcn-svelte@latest init` (it needs Tailwind CSS: `npx sv add tailwindcss`), then run this again.",
    );
    this.name = "MissingShadcnError";
  }
}
