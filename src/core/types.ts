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

export interface Result {
  creates: File[];
  modifies: File[];
  deletes: File[];
  components: Component[];
  packages: Package[];
}

export interface Pattern {
  slug: string;
  title: string;
  summary: string;

  // Categories and tags for browsing patterns on the website.
  categories: string[] | string;
  tags: string[] | string;

  // Example command for the pattern. This is used to generate the command for the pattern.
  command: {
    raw: string;
    argv: string[] | string[];
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
