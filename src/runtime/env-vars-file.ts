/**
 * The text half of `env-vars.ts`: no Node or ts-morph imports, so the
 * package's browser-safe entry can export it.
 */

/** Where SvelteKit 3 looks for the `variables` declarations, in order. */
export const ENV_DECL_CANDIDATES = ["src/env.ts", "src/env.js"];

/** The module `defineEnvVars` is imported from. */
export const ENV_MODULE = "@sveltejs/kit/env";

/** One variable to declare in `src/env.ts`. */
export interface EnvVarSpec {
  /** The variable's name, as `.env` and `$app/env/*` spell it. */
  name: string;
  /** Importable from `$app/env/public` (and so sent to the browser). */
  public?: boolean;
  /** Inlined at build time rather than read when the app starts. */
  static?: boolean;
  /**
   * Default `true`: declared with `schema: (value) => value ?? ''`, so a
   * missing value reads as `''` and the app builds and starts with an empty
   * `.env`. `false` leaves the schema out, which SvelteKit treats as required.
   */
  optional?: boolean;
  /** Shown on hover where the variable is imported. */
  description?: string;
}

/** What an optional variable is declared with, as `sv` and the templates write it. */
export const OPTIONAL_SCHEMA = "(value) => value ?? ''";

function stringLiteral(preferred: "'" | '"', value: string): string {
  // Prettier's rule: the other quote when it means fewer escapes.
  const other = preferred === "'" ? '"' : "'";
  const quote =
    value.split(preferred).length > value.split(other).length
      ? other
      : preferred;
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .split(quote)
    .join(`\\${quote}`);
  return `${quote}${escaped}${quote}`;
}

/**
 * One `NAME: { ... }` property, without a trailing comma. Nested lines are
 * indented with `indent`, one level deeper than the property itself.
 */
export function envVarEntry(
  spec: EnvVarSpec,
  options: { quote?: "'" | '"'; indent?: string } = {},
): string {
  const quote = options.quote ?? "'";
  const indent = options.indent ?? "\t";
  const fields: string[] = [];
  if (spec.public) fields.push("public: true");
  if (spec.static) fields.push("static: true");
  if (spec.optional !== false) {
    fields.push(`schema: ${OPTIONAL_SCHEMA.replace(/'/g, quote)}`);
  }
  if (spec.description) {
    fields.push(`description: ${stringLiteral(quote, spec.description)}`);
  }
  if (fields.length === 0) return `${spec.name}: {}`;
  return `${spec.name}: {\n${fields.map((field) => `${indent}${field}`).join(",\n")}\n}`;
}

/** Indent every line after the first by `prefix`. */
function indentTail(text: string, prefix: string): string {
  return text.split("\n").join(`\n${prefix}`);
}

/**
 * A new `src/env.ts` declaring `specs`, written the way the CLI's templates
 * write theirs: tabs, single quotes, one documented `defineEnvVars` call.
 */
export function envVarsFile(specs: EnvVarSpec[]): string {
  const seen = new Set<string>();
  const entries = specs
    .filter((spec) => !seen.has(spec.name) && !!seen.add(spec.name))
    .map((spec) => `\t${indentTail(envVarEntry(spec), "\t")}`);
  const body = entries.length > 0 ? `{\n${entries.join(",\n")}\n}` : "{}";
  return [
    `import { defineEnvVars } from '${ENV_MODULE}';`,
    "",
    "/**",
    " * Every environment variable the app reads. SvelteKit exposes only what is",
    " * declared here, through `$app/env/private` (and `$app/env/public` for",
    " * `public: true`).",
    " *",
    " * Each schema turns a missing value into `''`, so the app builds and starts",
    " * with an empty `.env`, and a default belongs at the call site as `X || fallback`.",
    " */",
    `export const variables = defineEnvVars(${body});`,
    "",
  ].join("\n");
}
