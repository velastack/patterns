import type { Collection } from "../parse/types";
import type { Logger } from "./logger";

export interface Features {
  auth: boolean;
  api: boolean;
  apiKeys: boolean;
  backend: boolean;
  i18n: boolean;
  teams: boolean;
  payments: boolean;
  blog: boolean;
  contentNegotiation: boolean;
  cms: boolean;
}

export interface Options {
  argv: string[];
  env: "runtime" | "preview";
  root: string;
  features: Features;
  /**
   * Reads the live collection schema. Required when `env` is `"runtime"`.
   *
   * Injected by the caller (`vela`) rather than resolved here, because reading
   * the schema may mean spawning a throwaway PocketBase, and only the CLI owns
   * that. Keeps this package free of process-spawning dependencies.
   */
  getCollections?: () => Promise<Collection[]>;
  /**
   * Pattern-specific named inputs (separate from positional argv).
   *
   * Conventional keys consumed by built-in patterns:
   * - `route` (string): override the default SvelteKit route for generators that
   *   produce pages. Format: `(group)/segment[/segment]*` (route group required;
   *   if omitted, the auth-aware default group is prepended). Dynamic segments
   *   like `[team_id]` are recognized and threaded into generated href/redirect
   *   expressions and test placeholders.
   * - `destructive` (boolean): consent flag for destroy patterns to perform
   *   filesystem and collection deletions.
   * - `variant` (string): selects an alternate template under `variants/`.
   */
  input: Record<string, any>;
  logger?: Logger;
}

export type Component = string;

/**
 * An npm install spec: either a bare name (`wuchale`, `@wuchale/svelte`) or a
 * name with a range (`wuchale@^0.26.3`). Ranges pin what a pattern installs;
 * without one, `npm install` resolves to whatever is latest at run time.
 */
export type Package = string;

export type PackageManagerOperation = "execute" | "install";
export type ExecuteCommand = (
  cwd: string,
  operation: PackageManagerOperation,
  args: string[],
) => Promise<void>;

/**
 * The seams for anything that leaves the process: the package-manager spawn
 * and the HTTP client the shadcn-svelte registry is read with.
 */
export interface WriteResultRuntime {
  executeCommand?: ExecuteCommand;
  fetch?: typeof fetch;
}

export interface InstallComponentsOptions {
  /** Project root: holds `package.json` and `components.json`. */
  root: string;
  /**
   * shadcn-svelte item names and/or the components this package ships
   * (`data-table`, `multiselect`, `geopoint`, ...).
   */
  components: Component[];
  /**
   * Re-add the named components even when their directory exists. Applies to
   * the named components only; the dependencies they pull in are still
   * installed only when missing.
   */
  overwrite?: boolean;
  logger?: Logger;
}

export interface InstallComponentsResult {
  /** Written this run: requested components plus the dependencies they pulled in, sorted. */
  installed: Component[];
  /** Requested but left alone because the directory already existed; empty with `overwrite`. */
  skipped: Component[];
  /** npm specs installed for the custom components, in install order. */
  packages: Package[];
}

/** One entry of a style's registry index (`/registry/styles/<style>/index.json`). */
export interface RegistryItem {
  name: string;
  /** `registry:ui`, `registry:block`, `registry:hook`, `registry:lib`, `registry:font`, ... */
  type: string;
}

export interface ListComponentsOptions {
  root: string;
}

export interface ListComponentsResult {
  /** The style `components.json` names (shadcn-svelte's default when it names none). */
  style: string;
  /** Directories under the project's ui directory, sorted. */
  installed: Component[];
  /** The components this package ships (`data-table`, `multiselect`, ...), sorted. */
  custom: Component[];
  /** Every item the style's registry index lists; empty when the registry could not be read. */
  registry: RegistryItem[];
  /** Why `registry` is empty, when the registry could not be read. */
  registryUnavailable?: string;
}

export interface SwitchStyleOptions {
  root: string;
  /** One of shadcn-svelte's styles: `nova`, `vega`, `maia`, ... */
  style: string;
  /**
   * Also apply the style's preset font (fontsource import, `--font-sans`,
   * `html { @apply font-sans }`), which is most of what makes a style look
   * as designed. Defaults to true.
   */
  font?: boolean;
  /**
   * Called with the components about to be re-added from the new style's
   * registry, before anything is written; return false to abort.
   */
  confirm?: (components: Component[]) => Promise<boolean> | boolean;
  logger?: Logger;
}

export interface SwitchStyleResult {
  /** `unchanged` when the project already had the style, `cancelled` when `confirm` said no. */
  status: "switched" | "unchanged" | "cancelled";
  style: string;
  /** Registry components re-added from the new style, sorted. */
  reinstalled: Component[];
  /** Relative paths written this run. */
  filesModified: string[];
  /** Packages that appeared in `package.json` this run (the preset font). */
  packages: Package[];
  /** Things worth a look afterwards, such as a previous font import left in the stylesheet. */
  hints: string[];
}

export interface ApplyBaseColorOptions {
  root: string;
  /** One of shadcn-svelte's base colors: `neutral`, `stone`, `zinc`, `mauve`, `olive`, `mist`, `taupe`. */
  color: string;
}

export interface ApplyThemeOptions {
  root: string;
  /** A base color or an accent (`blue`, `rose`, `emerald`, ...). */
  theme: string;
}

export interface ApplyColorsResult {
  /** What `components.json` records after the run. */
  baseColor: string;
  /** The accent applied to the tokens; the base color itself for `applyBaseColor`. */
  theme: string;
  /** Relative paths written this run. */
  filesModified: string[];
}

export interface Example {
  command: string;
  description: string;
}

export interface CollectionFieldSpec {
  name: string;
  type: string;
  required?: boolean;
  /** PocketBase collection id for relation fields (runtime). Preview may use the related collection name as a readable stand-in. */
  collectionId?: string;
  maxSelect?: number;
  minSelect?: number;
  values?: string[];
  onCreate?: boolean;
  onUpdate?: boolean;
  primaryKey?: boolean;
  cascadeDelete?: boolean;
  pattern?: string;
  min?: number;
  max?: number;
  autogeneratePattern?: string;
  exceptDomains?: null;
  onlyDomains?: null;
}

export interface CollectionSpec {
  name: string;
  type: "base" | "auth" | "view";
  listRule?: string | null;
  viewRule?: string | null;
  createRule?: string | null;
  updateRule?: string | null;
  deleteRule?: string | null;
  fields: CollectionFieldSpec[];
  /** View collection SQL (PocketBase). */
  viewQuery?: string;
  indexes?: string[];
}

/**
 * PocketBase rule fields applied in order after collections exist.
 * Use when create-time rules fail validation (e.g. cross-collection references)
 * or when rules must be layered after related collections are present.
 */
export interface CollectionRulesPatch {
  collectionName: string;
  listRule?: string | null;
  viewRule?: string | null;
  createRule?: string | null;
  updateRule?: string | null;
  deleteRule?: string | null;
}

export type FieldChange =
  | { op: "add"; field: CollectionFieldSpec }
  | { op: "remove"; fieldName: string }
  | { op: "rename"; from: string; to: string };

export interface CollectionFieldsPatch {
  collectionName: string;
  changes: FieldChange[];
}

export interface CollectionDropSpec {
  name: string;
  exists: boolean;
  rowCount: number;
}

export interface Result {
  creates: File[];
  modifies: File[];
  deletes: File[];
  components: Component[];
  packages: Package[];
  collections: CollectionSpec[];
  collectionPatches: CollectionFieldsPatch[];
  collectionDrops: CollectionDropSpec[];
}

export interface Pattern {
  version: string;
  slug: string;
  source: string;
  plan: "open" | "pro" | "agency";
  title: string;
  docs: string;
  summary: string;

  requires: Features;

  // Categories and tags for browsing patterns on the website.
  category: string;
  tags: string[];

  // Example command for the pattern. This is used to generate the command for the pattern.
  command: {
    raw: string;
    base: string;
    argv: string[];
  };

  examples: Example[];

  tests: number;

  // The baseline project that the pattern is based on.
  baseline: "sv" | "velastack" | "velastack-auth";

  // Optional named alternates that override files in creates/. Selected via options.input.variant.
  variants?: string[];

  // The main generator function for the pattern.
  generate: (options: Options) => Promise<Result>;
}

export type FileStatus = "success" | "failed" | "not-found";

export interface File {
  path: string;
  language: string;
  content: string;
  status: FileStatus;
  message?: string;
}

export type ModifyOutcome =
  | { status: "success"; changed: boolean }
  | { status: "failed"; message: string }
  | { status: "not-found"; message: string };
