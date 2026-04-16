export interface Features {
  auth: boolean;
  api: boolean;
  payments: boolean;
}

export interface Options {
  argv: string[];
  env: "runtime" | "preview";
  root: string;
  features: Features;
  input: Record<string, any>;
}

export type Component = string;
export type Package = string;

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

export interface Result {
  creates: File[];
  modifies: File[];
  deletes: File[];
  components: Component[];
  packages: Package[];
  collections: CollectionSpec[];
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

  // The baseline project that the pattern is based on.
  baseline: "sv" | "velastack" | "velastack-auth";

  // The main generator function for the pattern.
  generate: (options: Options) => Promise<Result>;
}

export interface File {
  path: string;
  language: string;
  content: string;
}
