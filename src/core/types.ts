export interface Features {
  auth: boolean;
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
  collectionId?: string;
  maxSelect?: number;
  values?: string[];
  onCreate?: boolean;
  onUpdate?: boolean;
}

export interface CollectionSpec {
  name: string;
  type: "base" | "auth" | "view";
  listRule?: string;
  viewRule?: string;
  createRule?: string;
  updateRule?: string;
  deleteRule?: string;
  fields: CollectionFieldSpec[];
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
