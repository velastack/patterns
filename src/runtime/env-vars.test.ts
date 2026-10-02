import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dedent from "dedent";
import { afterEach, describe, expect, it } from "vitest";
import {
  ENV_DECL_CANDIDATES,
  envVarsFile,
  modifyEnvVars,
  modifyEnvVarsFiles,
  unmodifyEnvVars,
  unmodifyEnvVarsFiles,
  type EnvVarSpec,
} from "./env-vars";

const roots: string[] = [];

afterEach(() => {
  while (roots.length) {
    fs.rmSync(roots.pop()!, { recursive: true, force: true });
  }
});

function makeRoot(files: Record<string, string> = {}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vela-env-vars-"));
  roots.push(root);
  for (const [name, content] of Object.entries(files)) {
    const abs = path.join(root, name);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

const read = (root: string, name = "src/env.ts") =>
  fs.readFileSync(path.join(root, name), "utf8");

const STRIPE: EnvVarSpec[] = [
  { name: "STRIPE_SECRET_KEY" },
  { name: "STRIPE_WEBHOOK_SECRET" },
  {
    name: "PUBLIC_STRIPE_PUBLISHABLE_KEY",
    public: true,
    description: "Stripe's publishable key.",
  },
];

/** The CLI minimal template's `src/env.ts`, cut down to one entry. */
const TEMPLATE =
  dedent`
  import { defineEnvVars } from '@sveltejs/kit/env';

  /**
   * Every environment variable the app reads.
   */
  export const variables = defineEnvVars({
  	POCKETBASE_URL: {
  		schema: (value) => value ?? '',
  		description: 'Where PocketBase listens.'
  	}
  });
` + "\n";

/** Apply twice: the second run must report no change and leave the file alone. */
function modifyTwice(root: string, specs: EnvVarSpec[]) {
  const first = modifyEnvVars(root, specs);
  const after = read(root);
  const second = modifyEnvVars(root, specs);
  expect(second.modify?.outcome).toEqual({ status: "success", changed: false });
  expect(read(root)).toBe(after);
  return { first, text: after };
}

function unmodifyTwice(root: string, names: string[]) {
  const first = unmodifyEnvVars(root, names);
  const after = fs.existsSync(first.filePath)
    ? fs.readFileSync(first.filePath, "utf8")
    : null;
  const second = unmodifyEnvVars(root, names);
  expect(second.outcome).toEqual({ status: "success", changed: false });
  expect(second.deleted).toBe(false);
  if (after !== null)
    expect(fs.readFileSync(first.filePath, "utf8")).toBe(after);
  return { first, text: after };
}

describe("envVarsFile", () => {
  it("writes the template's shape", () => {
    expect(
      envVarsFile([
        { name: "A" },
        {
          name: "B",
          public: true,
          static: true,
          optional: false,
          description: "b",
        },
        { name: "A" },
      ]),
    ).toBe(
      [
        "import { defineEnvVars } from '@sveltejs/kit/env';",
        "",
        "/**",
        " * Every environment variable the app reads. SvelteKit exposes only what is",
        " * declared here, through `$app/env/private` (and `$app/env/public` for",
        " * `public: true`).",
        " *",
        " * Each schema turns a missing value into `''`, so the app builds and starts",
        " * with an empty `.env`, and a default belongs at the call site as `X || fallback`.",
        " */",
        "export const variables = defineEnvVars({",
        "\tA: {",
        "\t\tschema: (value) => value ?? ''",
        "\t},",
        "\tB: {",
        "\t\tpublic: true,",
        "\t\tstatic: true,",
        "\t\tdescription: 'b'",
        "\t}",
        "});",
        "",
      ].join("\n"),
    );
  });

  it("declares nothing with no specs", () => {
    expect(envVarsFile([])).toContain(
      "export const variables = defineEnvVars({});",
    );
  });
});

describe("modifyEnvVars", () => {
  it("creates src/env.ts when the project has none", () => {
    const root = makeRoot();
    const { create, modify } = modifyEnvVars(root, STRIPE);
    expect(modify).toBeUndefined();
    expect(create).toMatchObject({
      path: path.join(root, "src/env.ts"),
      language: "ts",
      status: "success",
      content: envVarsFile(STRIPE),
    });
    // Nothing is written until writeResult runs.
    expect(fs.existsSync(path.join(root, "src/env.ts"))).toBe(false);
  });

  it("creates nothing for no specs", () => {
    expect(modifyEnvVars(makeRoot(), [])).toEqual({});
  });

  it("adds missing entries after the existing ones, in the template's style", () => {
    const root = makeRoot({ "src/env.ts": TEMPLATE });
    const { first, text } = modifyTwice(root, STRIPE);
    expect(first.modify?.outcome).toEqual({ status: "success", changed: true });
    expect(text).toBe(
      TEMPLATE.replace(
        "\t}\n});",
        [
          "\t},",
          "\tSTRIPE_SECRET_KEY: {",
          "\t\tschema: (value) => value ?? ''",
          "\t},",
          "\tSTRIPE_WEBHOOK_SECRET: {",
          "\t\tschema: (value) => value ?? ''",
          "\t},",
          "\tPUBLIC_STRIPE_PUBLISHABLE_KEY: {",
          "\t\tpublic: true,",
          "\t\tschema: (value) => value ?? '',",
          `\t\tdescription: "Stripe's publishable key."`,
          "\t}",
          "});",
        ].join("\n"),
      ),
    );
  });

  it("never touches an existing entry, quoted or not", () => {
    const source =
      dedent`
      import { defineEnvVars } from '@sveltejs/kit/env';

      export const variables = defineEnvVars({
      	STRIPE_SECRET_KEY: {},
      	'STRIPE_WEBHOOK_SECRET': { schema: (input) => input ?? '' },
      	"PUBLIC_STRIPE_PUBLISHABLE_KEY": { public: true, static: true }
      });
    ` + "\n";
    const root = makeRoot({ "src/env.ts": source });
    const { modify } = modifyEnvVars(root, STRIPE);
    expect(modify?.outcome).toEqual({ status: "success", changed: false });
    expect(read(root)).toBe(source);
  });

  it("edits `const variables = ...; export { variables }`", () => {
    const root = makeRoot({
      "src/env.ts":
        dedent`
        import { defineEnvVars } from "@sveltejs/kit/env";

        const variables = defineEnvVars({
          A: {},
        });

        export { variables };
      ` + "\n",
    });
    const { text } = modifyTwice(root, [{ name: "B", description: "it's b" }]);
    expect(text).toBe(
      dedent`
        import { defineEnvVars } from "@sveltejs/kit/env";

        const variables = defineEnvVars({
          A: {},
          B: {
            schema: (value) => value ?? "",
            description: "it's b"
          }
        });

        export { variables };
      ` + "\n",
    );
  });

  it("edits a plain object literal", () => {
    const root = makeRoot({
      "src/env.js": "export const variables = {\n  A: { public: true }\n};\n",
    });
    const { first, text } = modifyTwice2(root, "src/env.js", [{ name: "B" }]);
    expect(first.modify?.filePath).toBe(path.join(root, "src/env.js"));
    expect(text).toBe(
      [
        "export const variables = {",
        "  A: { public: true },",
        "  B: {",
        "    schema: (value) => value ?? ''",
        "  }",
        "};",
        "",
      ].join("\n"),
    );
  });

  it("adds the call and its import to a file without `variables`", () => {
    const root = makeRoot({ "src/env.ts": "// Declared below.\n" });
    const { text } = modifyTwice(root, [{ name: "A", static: true }]);
    expect(text).toBe(
      [
        "import { defineEnvVars } from '@sveltejs/kit/env';",
        "",
        "// Declared below.",
        "",
        "export const variables = defineEnvVars({",
        "\tA: {",
        "\t\tstatic: true,",
        "\t\tschema: (value) => value ?? ''",
        "\t}",
        "});",
        "",
      ].join("\n"),
    );
  });

  it("fills an empty src/env.ts", () => {
    const root = makeRoot({ "src/env.ts": "" });
    const { text } = modifyTwice(root, [{ name: "A" }]);
    expect(text).toBe(
      [
        "import { defineEnvVars } from '@sveltejs/kit/env';",
        "",
        "export const variables = defineEnvVars({",
        "\tA: {",
        "\t\tschema: (value) => value ?? ''",
        "\t}",
        "});",
        "",
      ].join("\n"),
    );
  });

  it("reuses an existing @sveltejs/kit/env import", () => {
    const root = makeRoot({
      "src/env.ts":
        "import { defineEnvVars } from '@sveltejs/kit/env';\n\nexport const other = 1;\n",
    });
    const { text } = modifyTwice(root, [{ name: "A" }]);
    expect(text.match(/@sveltejs\/kit\/env/g)).toHaveLength(1);
    expect(text).toContain("export const variables = defineEnvVars({");
  });

  it.each([
    [
      "a spread",
      "const shared = {};\nexport const variables = defineEnvVars({ ...shared });\n",
      "spreads in another object",
    ],
    [
      "a computed key",
      "const k = 'A';\nexport const variables = defineEnvVars({ [k]: {} });\n",
      "has a computed key",
    ],
    [
      "a non-object value",
      "export const variables = load();\n",
      "is not an object literal",
    ],
    [
      "a re-export",
      "export { variables } from './env.shared';\n",
      "not a variable this can edit",
    ],
    [
      "an unexported local",
      "const variables = defineEnvVars({});\n",
      "not a variable this can edit",
    ],
    [
      "a function",
      "export function variables() {}\n",
      "not a variable this can edit",
    ],
  ])("fails with paste-ready entries on %s", (_, source, why) => {
    const root = makeRoot({ "src/env.ts": source });
    const { modify } = modifyEnvVars(root, STRIPE);
    expect(modify?.outcome.status).toBe("failed");
    const message =
      modify?.outcome.status === "failed" ? modify.outcome.message : "";
    expect(message).toContain(`Could not edit src/env.ts: `);
    expect(message).toContain(why);
    expect(message).toContain(
      [
        "STRIPE_SECRET_KEY: {",
        "\tschema: (value) => value ?? ''",
        "},",
        "STRIPE_WEBHOOK_SECRET: {",
        "\tschema: (value) => value ?? ''",
        "},",
        "PUBLIC_STRIPE_PUBLISHABLE_KEY: {",
        "\tpublic: true,",
        "\tschema: (value) => value ?? '',",
        `\tdescription: "Stripe's publishable key."`,
        "},",
      ].join("\n"),
    );
    expect(read(root)).toBe(source);
  });

  it("prefers src/env.ts over src/env.js", () => {
    expect(ENV_DECL_CANDIDATES).toEqual(["src/env.ts", "src/env.js"]);
    const root = makeRoot({
      "src/env.ts": "export const variables = {};\n",
      "src/env.js": "export const variables = {};\n",
    });
    expect(modifyEnvVars(root, [{ name: "A" }]).modify?.filePath).toBe(
      path.join(root, "src/env.ts"),
    );
    expect(read(root, "src/env.js")).toBe("export const variables = {};\n");
  });

  it("modifyEnvVarsFiles reports a create or a changed file", () => {
    const empty = makeRoot();
    expect(modifyEnvVarsFiles(empty, [{ name: "A" }])).toMatchObject({
      create: { path: path.join(empty, "src/env.ts") },
      modify: null,
    });

    const root = makeRoot({ "src/env.ts": TEMPLATE });
    const files = modifyEnvVarsFiles(root, [{ name: "A" }]);
    expect(files.create).toBeNull();
    expect(files.modify).toMatchObject({
      path: path.join(root, "src/env.ts"),
      status: "success",
      content: read(root),
    });
    expect(modifyEnvVarsFiles(root, [{ name: "A" }]).modify).toBeNull();
  });
});

function modifyTwice2(root: string, rel: string, specs: EnvVarSpec[]) {
  const first = modifyEnvVars(root, specs);
  const after = read(root, rel);
  const second = modifyEnvVars(root, specs);
  expect(second.modify?.outcome).toEqual({ status: "success", changed: false });
  expect(read(root, rel)).toBe(after);
  return { first, text: after };
}

describe("unmodifyEnvVars", () => {
  it("removes only the named entries", () => {
    const root = makeRoot({ "src/env.ts": TEMPLATE });
    modifyEnvVars(root, STRIPE);
    const { first, text } = unmodifyTwice(
      root,
      STRIPE.map((spec) => spec.name),
    );
    expect(first.outcome).toEqual({ status: "success", changed: true });
    expect(first.deleted).toBe(false);
    expect(text).toBe(TEMPLATE);
  });

  it("removes quoted keys", () => {
    const root = makeRoot({
      "src/env.ts":
        dedent`
        import { defineEnvVars } from '@sveltejs/kit/env';

        export const variables = defineEnvVars({
        	'A': { schema: (input) => input ?? '' },
        	"B": {},
        	C: {}
        });
      ` + "\n",
    });
    const { text } = unmodifyTwice(root, ["A", "B"]);
    expect(text).toBe(
      dedent`
        import { defineEnvVars } from '@sveltejs/kit/env';

        export const variables = defineEnvVars({
        	C: {}
        });
      ` + "\n",
    );
  });

  it("reports deleted when only the import and an empty variables remain", () => {
    const root = makeRoot();
    fs.mkdirSync(path.join(root, "src"));
    fs.writeFileSync(path.join(root, "src/env.ts"), envVarsFile(STRIPE));
    const { first, text } = unmodifyTwice(
      root,
      STRIPE.map((spec) => spec.name),
    );
    expect(first).toMatchObject({
      outcome: { status: "success", changed: true },
      deleted: true,
    });
    // The header comment doesn't keep the file alive.
    expect(text).toContain("export const variables = defineEnvVars({});");
  });

  it("reports deleted for the export { variables } shape too", () => {
    const root = makeRoot({
      "src/env.ts":
        "import { defineEnvVars } from '@sveltejs/kit/env';\n\nconst variables = defineEnvVars({ A: {} });\n\nexport { variables };\n",
    });
    expect(unmodifyEnvVars(root, ["A"]).deleted).toBe(true);
  });

  it("keeps a file that still holds something else", () => {
    const root = makeRoot({
      "src/env.ts":
        "import { defineEnvVars } from '@sveltejs/kit/env';\n\nexport const variables = defineEnvVars({ A: {} });\n\nexport const other = 1;\n",
    });
    const result = unmodifyEnvVars(root, ["A"]);
    expect(result.outcome).toEqual({ status: "success", changed: true });
    expect(result.deleted).toBe(false);
  });

  it("is a no-op without the file or without the names", () => {
    const empty = makeRoot();
    expect(unmodifyEnvVars(empty, ["A"])).toEqual({
      filePath: path.join(empty, "src/env.ts"),
      outcome: { status: "success", changed: false },
      deleted: false,
    });
    const root = makeRoot({ "src/env.ts": TEMPLATE });
    expect(unmodifyEnvVars(root, ["A"])).toMatchObject({
      outcome: { status: "success", changed: false },
      deleted: false,
    });
    expect(read(root)).toBe(TEMPLATE);
  });

  it("fails with the names to remove when the shape can't be edited", () => {
    const source = "export const variables = load();\n";
    const root = makeRoot({ "src/env.ts": source });
    const result = unmodifyEnvVars(root, ["A", "B"]);
    expect(result.outcome).toEqual({
      status: "failed",
      message: expect.stringContaining(
        "Remove these declarations from `variables` by hand: A, B",
      ),
    });
    expect(read(root)).toBe(source);
  });

  it("unmodifyEnvVarsFiles turns an emptied file into a delete", () => {
    const root = makeRoot();
    fs.mkdirSync(path.join(root, "src"));
    fs.writeFileSync(
      path.join(root, "src/env.ts"),
      envVarsFile([{ name: "A" }]),
    );
    expect(unmodifyEnvVarsFiles(root, ["A"])).toEqual({
      modify: null,
      delete: {
        path: path.join(root, "src/env.ts"),
        language: "ts",
        content: "",
        status: "success",
      },
    });

    const kept = makeRoot({ "src/env.ts": TEMPLATE });
    modifyEnvVars(kept, [{ name: "A" }]);
    expect(unmodifyEnvVarsFiles(kept, ["A"])).toMatchObject({
      modify: { content: TEMPLATE },
      delete: null,
    });
  });
});
