import { describe, expect, it } from "vitest";
import type { Options } from "../core/types";
import type { Field } from "../parse";
import { getFieldComponents } from "../core/field";
import { getRemoteFieldComponents } from "../core/field/remote";
import { patterns } from "../index";
import { REGISTRY_COMPONENTS } from "./registry-components";
import { customDependencies, getAllCustomComponents } from "./write-result";

/*
 * No network here: the registry's side of this is the checked-in list. What
 * these tests pin is that nothing in the package asks for a component that is
 * neither bundled nor on that list.
 */

const bundled = new Set(getAllCustomComponents());
const registry = new Set<string>(REGISTRY_COMPONENTS);
const unknown = (names: Iterable<string>) =>
  [...new Set(names)]
    .filter((name) => !bundled.has(name) && !registry.has(name))
    .sort();

const FEATURES = {
  auth: false,
  api: false,
  apiKeys: false,
  backend: false,
  i18n: false,
  teams: false,
  payments: false,
  blog: false,
  contentNegotiation: false,
  cms: false,
};
type Features = Options["features"];
const ALL_FEATURES = Object.fromEntries(
  Object.keys(FEATURES).map((key) => [key, true]),
) as unknown as Features;

/** Feature sets and providers that switch a pattern's component list. */
const PERMUTATIONS: Pick<Options, "features" | "providers" | "input">[] = [
  { features: FEATURES as Features, input: {} },
  { features: ALL_FEATURES, input: {} },
  ...["stripe", "shopify", "whatsapp"].map((payments) => ({
    features: ALL_FEATURES,
    providers: { payments },
    input: {},
  })),
];

const FIELD_TYPES: Field["type"][] = [
  "text",
  "number",
  "email",
  "password",
  "bool",
  "date",
  "select",
  "file",
  "json",
  "geoPoint",
  "relation",
  "url",
  "editor",
  "autodate",
];

/** `ui/<name>` in an import of a generated file, whatever the alias. */
const UI_IMPORT = /components\/ui\/([a-z0-9-]+)\//g;

/**
 * Files copied into a project, and the generator sources that build imports
 * as strings. Fixtures, preview stand-ins and the frozen `originals` are
 * someone else's files: they name components the CLI's templates carry
 * (`navbar`, `sonner`), which no pattern installs.
 */
const sources = import.meta.glob<string>(
  [
    "../patterns/**/*.{svelte,ts}",
    "../core/**/*.ts",
    "../ui/components/**/*.{svelte,ts}",
    "!../**/*.test.ts",
    "!../**/fixtures/**",
    "!../**/preview-modifies/**",
    "!../**/originals/**",
  ],
  { query: "?raw", import: "default", eager: true },
);

describe("the components the patterns require", () => {
  it("bundles form, which the registry no longer has", () => {
    expect(bundled.has("form")).toBe(true);
    expect(registry.has("form")).toBe(false);
  });

  it("keeps the list and the bundled components apart", () => {
    expect(REGISTRY_COMPONENTS.filter((name) => bundled.has(name))).toEqual([]);
    expect([...REGISTRY_COMPONENTS]).toEqual([...REGISTRY_COMPONENTS].sort());
  });

  it("declares dependencies for every bundled component, all of them known", () => {
    expect(Object.keys(customDependencies).sort()).toEqual([...bundled].sort());
    expect(unknown(Object.values(customDependencies).flat())).toEqual([]);
  });

  it("knows every component a field type maps to", () => {
    const fields = FIELD_TYPES.map((type) => ({ type }) as Field);
    expect(
      unknown([
        ...getFieldComponents(fields),
        ...getRemoteFieldComponents(fields),
      ]),
    ).toEqual([]);
  });

  it("knows every ui component the generated files import", () => {
    const imported = new Map<string, string>();
    for (const [file, content] of Object.entries(sources)) {
      for (const match of content.matchAll(UI_IMPORT)) {
        imported.set(match[1]!, file);
      }
    }
    // The scan has to be reading the templates for its answer to mean much.
    expect(imported.has("form")).toBe(true);
    expect(imported.has("sidebar")).toBe(true);
    expect(
      unknown(imported.keys()).map((name) => `${name} (${imported.get(name)})`),
    ).toEqual([]);
  });

  it("knows every component a pattern returns", async () => {
    const required = new Map<string, string>();
    const generated = new Set<string>();
    for (const pattern of patterns) {
      for (const permutation of PERMUTATIONS) {
        const options: Options = {
          argv: pattern.command.argv,
          env: "preview",
          root: "/tmp/project",
          ...permutation,
        };
        let components: string[];
        try {
          components = (await pattern.generate(options)).components;
        } catch {
          // Not every pattern accepts every permutation (a provider it does
          // not have); each has to accept at least one, checked below.
          continue;
        }
        generated.add(pattern.slug);
        for (const component of components) {
          required.set(component, pattern.slug);
        }
      }
    }

    expect(
      patterns.map((p) => p.slug).filter((s) => !generated.has(s)),
    ).toEqual([]);
    // auth and teams are where `form` went missing.
    expect(required.has("form")).toBe(true);
    expect(
      unknown(required.keys()).map((name) => `${name} (${required.get(name)})`),
    ).toEqual([]);
    // Preview output is formatted, which is most of the time this takes.
  }, 120_000);
});
